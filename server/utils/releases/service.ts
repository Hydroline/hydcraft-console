import { z } from 'zod'
import { prisma } from '../db/prisma'
import { createApiError } from '../errors'
import { enqueuePostCommitEvent } from '../events/post-commit'
import { updaterArtifactInputSchema, updaterManifestSchema } from './contracts'

const updaterVersion = z
	.string()
	.regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/)

const updaterVersionCore = (version: string) =>
	version
		.split(/[+-]/, 1)[0]
		.split('.')
		.map((part) => Number(part))

const compareUpdaterVersions = (left: string, right: string) => {
	const a = updaterVersionCore(left)
	const b = updaterVersionCore(right)
	for (let index = 0; index < 3; index += 1) {
		const difference = (a[index] ?? 0) - (b[index] ?? 0)
		if (difference) return difference
	}
	return 0
}

export const createDraftRevision = async (input: {
	kind: 'UPDATER'
	version: string
	manifest: unknown
	actorId?: string
}) => {
	const version = updaterVersion.parse(input.version)
	const manifest = updaterManifestSchema.parse(input.manifest)
	return prisma.$transaction(async (tx) => {
		const latest = await tx.releaseRevision.findFirst({
			where: { kind: input.kind, version },
			orderBy: { revision: 'desc' },
			select: { revision: true },
		})
		const release = await tx.releaseRevision.create({
			data: {
				kind: input.kind,
				version,
				revision: (latest?.revision ?? 0) + 1,
				manifest,
				createdById: input.actorId,
			},
		})
		await enqueuePostCommitEvent(tx, 'audit.log', {
			action: 'CREATED',
			resource: 'release-revision',
			resourceId: release.id,
			actorId: input.actorId,
			payload: { kind: input.kind, version },
		})
		return release
	})
}

const updaterPlatforms = ['windows-x86_64', 'macos-universal'] as const
type UpdaterPlatform = (typeof updaterPlatforms)[number]

const manifestRecord = (value: unknown) =>
	value && typeof value === 'object' && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null

const updaterCandidateMatches = (
	revision: { manifest: unknown; status: string },
	commitSha: string,
	platform: UpdaterPlatform,
) => {
	const manifest = manifestRecord(revision.manifest)
	return manifest?.commitSha === commitSha && manifest.platform === platform
}

/**
 * Registers one CNB-built platform artifact. The two platform revisions are
 * published together only after both callbacks for the same commit arrive.
 */
export const registerUpdaterArtifact = async (
	input: unknown,
	actorId?: string,
) => {
	const artifact = updaterArtifactInputSchema.parse(input)
	return prisma.$transaction(async (tx) => {
		await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('hydcraft:updater:publish'))`

		const source = await tx.distributionSource.findUnique({
			where: { key: 'dl-updater' },
			select: { baseUrl: true, enabled: true, scope: true },
		})
		if (!source?.enabled || source.scope !== 'UPDATER')
			throw createApiError(503, 'UPDATER_DISTRIBUTION_SOURCE_UNAVAILABLE')
		const latestPublished = await tx.releaseRevision.findFirst({
			where: { kind: 'UPDATER', status: 'PUBLISHED' },
			orderBy: { publishedAt: 'desc' },
			select: { version: true },
		})
		if (
			latestPublished &&
			compareUpdaterVersions(artifact.version, latestPublished.version) < 0
		)
			throw createApiError(409, 'UPDATER_ARTIFACT_STALE')

		const downloadUrl = new URL(
			`${artifact.objectKey.replace(/^\/+/, '')}`,
			`${source.baseUrl.replace(/\/+$/, '')}/`,
		).toString()
		const manifest = updaterManifestSchema.parse({
			schemaVersion: 1,
			version: artifact.version,
			platform: artifact.platform,
			urls: [downloadUrl],
			sha256: artifact.sha256,
			commitSha: artifact.commitSha,
			objectKey: artifact.objectKey,
			size: artifact.size,
		})

		const revisions = await tx.releaseRevision.findMany({
			where: { kind: 'UPDATER', version: artifact.version },
			orderBy: { revision: 'desc' },
		})
		const publishedOtherCommit = revisions.find((candidate) => {
			if (candidate.status !== 'PUBLISHED') return false
			const manifest = manifestRecord(candidate.manifest)
			return Boolean(
				manifest?.commitSha && manifest.commitSha !== artifact.commitSha,
			)
		})
		if (publishedOtherCommit)
			throw createApiError(409, 'UPDATER_VERSION_ALREADY_PUBLISHED')
		let revision = revisions.find((candidate) =>
			updaterCandidateMatches(candidate, artifact.commitSha, artifact.platform),
		)
		if (revision?.status === 'ARCHIVED') revision = undefined
		if (revision) {
			if (revision.status === 'PUBLISHED') {
				const existing = updaterManifestSchema.parse(revision.manifest)
				if (
					existing.sha256 !== artifact.sha256 ||
					existing.objectKey !== artifact.objectKey ||
					existing.size !== artifact.size
				)
					throw createApiError(409, 'UPDATER_ARTIFACT_IMMUTABLE')
			}
			if (revision.status === 'DRAFT') {
				revision = await tx.releaseRevision.update({
					where: { id: revision.id },
					data: { manifest },
				})
			}
		} else {
			const nextRevision = (revisions[0]?.revision ?? 0) + 1
			revision = await tx.releaseRevision.create({
				data: {
					kind: 'UPDATER',
					version: artifact.version,
					revision: nextRevision,
					manifest,
					createdById: actorId,
				},
			})
			await enqueuePostCommitEvent(tx, 'audit.log', {
				action: 'CREATED',
				resource: 'release-revision',
				resourceId: revision.id,
				actorId,
				payload: {
					kind: 'UPDATER',
					version: artifact.version,
					commitSha: artifact.commitSha,
					platform: artifact.platform,
				},
			})
		}

		const candidates = [
			revision,
			...revisions.filter(
				(candidate) =>
					candidate.id !== revision.id &&
					candidate.status !== 'ARCHIVED' &&
					updaterCandidateMatches(
						candidate,
						artifact.commitSha,
						(manifestRecord(candidate.manifest)?.platform ??
							'') as UpdaterPlatform,
					),
			),
		]
		const platformCandidates = new Map<UpdaterPlatform, typeof revision>()
		for (const candidate of candidates) {
			const platform = manifestRecord(candidate.manifest)?.platform
			if (
				updaterPlatforms.includes(platform as UpdaterPlatform) &&
				!platformCandidates.has(platform as UpdaterPlatform)
			)
				platformCandidates.set(platform as UpdaterPlatform, candidate)
		}
		const ready = updaterPlatforms.every((platform) =>
			platformCandidates.has(platform),
		)
		const alreadyPublished =
			ready &&
			updaterPlatforms.every(
				(platform) => platformCandidates.get(platform)?.status === 'PUBLISHED',
			)
		if (ready && !alreadyPublished) {
			const publishedAt = new Date()
			for (const platform of updaterPlatforms) {
				await tx.releaseRevision.updateMany({
					where: {
						kind: 'UPDATER',
						status: 'PUBLISHED',
						manifest: { path: ['platform'], equals: platform },
					},
					data: { status: 'ARCHIVED' },
				})
			}
			const publishedIds = updaterPlatforms.map(
				(platform) => platformCandidates.get(platform)!.id,
			)
			await tx.releaseRevision.updateMany({
				where: { id: { in: publishedIds } },
				data: { status: 'PUBLISHED', publishedAt },
			})
			for (const id of publishedIds) {
				await enqueuePostCommitEvent(tx, 'audit.log', {
					action: 'PUBLISHED',
					resource: 'release-revision',
					resourceId: id,
					actorId,
					payload: {
						kind: 'UPDATER',
						version: artifact.version,
						commitSha: artifact.commitSha,
					},
				})
			}
		}
		const archivedRevisions = ready
			? await tx.releaseRevision.findMany({
					where: { kind: 'UPDATER', status: 'ARCHIVED' },
					select: { manifest: true },
				})
			: []
		const cleanupObjectKeys = [
			...new Set(
				archivedRevisions
					.map((candidate) => manifestRecord(candidate.manifest)?.objectKey)
					.filter(
						(key): key is string =>
							typeof key === 'string' && key.startsWith('updater/'),
					),
			),
		]
		return {
			version: artifact.version,
			commitSha: artifact.commitSha,
			ready,
			published: ready,
			cleanupObjectKeys,
			platforms: updaterPlatforms.filter((platform) =>
				platformCandidates.has(platform),
			),
			revision,
		}
	})
}

export const publishRevision = async (id: string, actorId: string) =>
	prisma.$transaction(async (tx) => {
		const revision = await tx.releaseRevision.findUnique({ where: { id } })
		if (!revision) throw createApiError(404, 'RELEASE_NOT_FOUND')
		const updaterPlatform =
			revision.kind === 'UPDATER'
				? updaterManifestSchema.parse(revision.manifest).platform
				: undefined
		await tx.releaseRevision.updateMany({
			where: {
				kind: revision.kind,
				status: 'PUBLISHED',
				...(updaterPlatform
					? { manifest: { path: ['platform'], equals: updaterPlatform } }
					: {}),
			},
			data: { status: 'ARCHIVED' },
		})
		const published = await tx.releaseRevision.update({
			where: { id },
			data: {
				status: 'PUBLISHED',
				publishedAt: new Date(),
			},
		})
		await enqueuePostCommitEvent(tx, 'audit.log', {
			action: 'PUBLISHED',
			resource: 'release-revision',
			resourceId: id,
			actorId,
			payload: {
				kind: revision.kind,
				version: revision.version,
				revision: revision.revision,
			},
		})
		return published
	})

export const updateDraftRevision = async (
	id: string,
	manifestInput: unknown,
	actorId: string,
) =>
	prisma.$transaction(async (tx) => {
		const existing = await tx.releaseRevision.findUnique({ where: { id } })
		if (!existing) throw createApiError(404, 'RELEASE_NOT_FOUND')
		if (existing.status !== 'DRAFT')
			throw createApiError(409, 'RELEASE_REVISION_NOT_EDITABLE')
		if (existing.kind !== 'UPDATER')
			throw createApiError(409, 'LEGACY_CLIENT_RELEASE_UNSUPPORTED')
		const manifest = updaterManifestSchema.parse(manifestInput)
		const updated = await tx.releaseRevision.update({
			where: { id },
			data: { manifest },
		})
		await enqueuePostCommitEvent(tx, 'audit.log', {
			action: 'UPDATED',
			resource: 'release-revision',
			resourceId: id,
			actorId,
		})
		return updated
	})

export const rollbackRevision = async (id: string, actorId: string) =>
	prisma.$transaction(async (tx) => {
		const source = await tx.releaseRevision.findUnique({ where: { id } })
		if (!source) throw createApiError(404, 'RELEASE_NOT_FOUND')
		const latest = await tx.releaseRevision.aggregate({
			where: { kind: source.kind, version: source.version },
			_max: { revision: true },
		})
		const draft = await tx.releaseRevision.create({
			data: {
				kind: source.kind,
				version: source.version,
				revision: (latest._max.revision ?? 0) + 1,
				manifest: source.manifest,
				createdById: actorId,
			},
		})
		await enqueuePostCommitEvent(tx, 'audit.log', {
			action: 'CREATED',
			resource: 'release-rollback-draft',
			resourceId: draft.id,
			actorId,
			payload: { sourceRevisionId: id },
		})
		return draft
	})

export const getPublishedManifest = async (
	kind: 'UPDATER',
	platform?: 'windows-x86_64' | 'macos-universal',
) => {
	const revision = await prisma.releaseRevision.findFirst({
		where: {
			kind,
			status: 'PUBLISHED',
			...(platform
				? { manifest: { path: ['platform'], equals: platform } }
				: {}),
		},
		orderBy: { publishedAt: 'desc' },
	})
	if (!revision) throw createApiError(404, 'PUBLISHED_RELEASE_NOT_FOUND')
	return revision.manifest
}
