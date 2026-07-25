import { z } from 'zod'
import { prisma } from '../db/prisma'
import { createApiError } from '../errors'
import { enqueuePostCommitEvent } from '../events/post-commit'
import { updaterManifestSchema } from './contracts'

const updaterVersion = z
	.string()
	.regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/)

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
