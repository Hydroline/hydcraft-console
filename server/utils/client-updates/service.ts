import { randomUUID } from 'node:crypto'
import { prisma } from '../db/prisma'
import { createApiError } from '../errors'
import { enqueuePostCommitEvent } from '../events/post-commit'
import { resolveDeliveryUrl, sourceDelivery } from '../delivery/edgeone'
import type { ClientMigrationInput, ClientReleaseInput } from './contracts'

type LocalizedLabels = Record<string, unknown>

export interface UpdaterVersion {
	version: string
	label: string
	isLatest: boolean
	publishedAt: string | null
	changelog: string | null
	apiVersion: string | null
	modCount: number
	mods: UpdaterMod[]
}

export interface UpdaterMod {
	id: string
	name: string
	version: string
	description?: string
	api?: string
}

export interface UpdaterSource {
	key: string
	label: string
	priority: number
	requiresLogin: boolean
	available: boolean
}

export interface UpdaterSourceProbeTarget {
	baseUrl: string
	requiresLogin: boolean
}

const localizedLabel = (labels: unknown, locale = 'zh-CN') => {
	if (!labels || typeof labels !== 'object') return ''
	const values = labels as LocalizedLabels
	return String(values[locale] ?? values['zh-CN'] ?? values.en ?? '')
}

const versionParts = (version: string) => version.split('.').map(Number)

const compareVersions = (left: string, right: string) => {
	const a = versionParts(left)
	const b = versionParts(right)
	for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
		const difference = (a[index] ?? 0) - (b[index] ?? 0)
		if (difference) return difference
	}
	return 0
}

const withMigrationAnchors = (plan: unknown, anchors: unknown) =>
	plan && typeof plan === 'object' && !Array.isArray(plan)
		? { ...(plan as Record<string, unknown>), anchors }
		: plan

const nextMigrationRecord = async (currentVersion: string) => {
	const fromRelease = await prisma.clientRelease.findFirst({
		where: { version: currentVersion, status: 'PUBLISHED' },
		orderBy: { publishedAt: 'desc' },
	})
	if (!fromRelease) return null
	return prisma.clientMigration.findFirst({
		where: { fromReleaseId: fromRelease.id, status: 'PUBLISHED' },
		include: { toRelease: true },
		orderBy: { publishedAt: 'asc' },
	})
}

export const listClientVersions = async (): Promise<UpdaterVersion[]> => {
	const releases = await prisma.clientRelease.findMany({
		where: { status: 'PUBLISHED' },
		select: { version: true, manifest: true, publishedAt: true },
	})
	const sorted = [...releases].sort((left, right) =>
		compareVersions(right.version, left.version),
	)
	const latest = sorted[0]?.version
	return sorted.map((release) => {
		const manifest =
			release.manifest && typeof release.manifest === 'object'
				? (release.manifest as Record<string, unknown>)
				: {}
		const metadata =
			manifest.metadata && typeof manifest.metadata === 'object'
				? (manifest.metadata as Record<string, unknown>)
				: {}
		const mods = Array.isArray(metadata.mods)
			? (metadata.mods as UpdaterMod[])
			: []
		return {
			version: release.version,
			label: release.version,
			isLatest: release.version === latest,
			publishedAt: release.publishedAt?.toISOString() ?? null,
			changelog:
				typeof manifest.changelog === 'string' ? manifest.changelog : null,
			apiVersion:
				typeof metadata.apiVersion === 'string' ? metadata.apiVersion : null,
			modCount: mods.length,
			mods,
		}
	})
}

export const listUpdaterSources = async (
	canUseProtectedSource: boolean,
	locale = 'zh-CN',
): Promise<UpdaterSource[]> => {
	const sources = await prisma.distributionSource.findMany({
		where: { enabled: true },
		orderBy: { priority: 'asc' },
		select: { key: true, labels: true, priority: true, policy: true },
	})
	return sources.map((source) => {
		const requiresLogin = sourceDelivery(source.policy) === 'edgeone'
		return {
			key: source.key,
			label: localizedLabel(source.labels, locale) || source.key,
			priority: source.priority,
			requiresLogin,
			available: !requiresLogin || canUseProtectedSource,
		}
	})
}

export const resolveUpdaterSourceProbeTarget = async (
	key: string,
): Promise<UpdaterSourceProbeTarget | null> => {
	const source = await prisma.distributionSource.findFirst({
		where: { key, enabled: true },
		select: { baseUrl: true, policy: true },
	})
	if (!source) return null
	return {
		baseUrl: source.baseUrl,
		requiresLogin: sourceDelivery(source.policy) === 'edgeone',
	}
}

export const checkClientMigration = async (currentVersion: string) => {
	const migration = await nextMigrationRecord(currentVersion)
	return {
		currentVersion,
		updateAvailable: Boolean(migration),
		toVersion: migration?.toRelease.version ?? currentVersion,
		migrationId: migration?.id ?? null,
	}
}

export const createClientRelease = async (
	input: ClientReleaseInput,
	actorId?: string,
) =>
	prisma.$transaction(async (tx) => {
		const existing = await tx.clientRelease.findUnique({
			where: { version: input.version },
		})
		const existingManifest =
			existing?.manifest && typeof existing.manifest === 'object'
				? (existing.manifest as Record<string, unknown>)
				: {}
		const manifest = { ...existingManifest, ...input.manifest }
		const release = existing
			? await tx.clientRelease.update({
					where: { version: input.version },
					data: { manifest },
				})
			: await tx.clientRelease.create({
					data: {
						id: randomUUID(),
						...input,
						manifest,
						createdById: actorId,
					},
				})
		await enqueuePostCommitEvent(tx, 'release.created', {
			resourceId: release.id,
			kind: 'client-release',
			actorId,
		})
		return release
	})

export const getPublishedClientBase = async (clientId: string) => {
	const releases = await prisma.clientRelease.findMany({
		where: { status: 'PUBLISHED' },
		orderBy: { publishedAt: 'desc' },
		take: 100,
	})
	for (const release of releases) {
		if (!release.manifest || typeof release.manifest !== 'object') continue
		const manifest = release.manifest as Record<string, unknown>
		if (manifest.clientId !== clientId || !manifest.base) continue
		return {
			clientId,
			version: release.version,
			...(manifest.base as Record<string, unknown>),
		}
	}
	throw createApiError(404, 'PUBLISHED_CLIENT_BASE_NOT_FOUND')
}

export const publishClientRelease = async (id: string, actorId: string) =>
	prisma.$transaction(async (tx) => {
		const release = await tx.clientRelease.findUnique({ where: { id } })
		if (!release) throw createApiError(404, 'CLIENT_RELEASE_NOT_FOUND')
		const published = await tx.clientRelease.update({
			where: { id },
			data: { status: 'PUBLISHED', publishedAt: new Date() },
		})
		await enqueuePostCommitEvent(tx, 'audit.log', {
			action: 'PUBLISHED',
			resource: 'client-release',
			resourceId: id,
			actorId,
		})
		return published
	})

export const createClientMigration = async (
	input: ClientMigrationInput,
	actorId?: string,
) =>
	prisma.$transaction(async (tx) => {
		if (
			input.plan.fromVersion !== input.fromVersion ||
			input.plan.toVersion !== input.toVersion
		)
			throw createApiError(400, 'MIGRATION_PLAN_VERSION_MISMATCH')
		const [fromRelease, toRelease] = await Promise.all([
			tx.clientRelease.findUnique({
				where: { version: input.fromVersion },
			}),
			tx.clientRelease.findUnique({
				where: { version: input.toVersion },
			}),
		])
		if (!fromRelease || !toRelease)
			throw createApiError(400, 'MIGRATION_RELEASE_NOT_FOUND')
		const {
			fromVersion: _fromVersion,
			toVersion: _toVersion,
			...migrationInput
		} = input
		const migration = await tx.clientMigration.upsert({
			where: {
				fromReleaseId_toReleaseId: {
					fromReleaseId: fromRelease.id,
					toReleaseId: toRelease.id,
				},
			},
			create: {
				id: randomUUID(),
				...migrationInput,
				fromReleaseId: fromRelease.id,
				toReleaseId: toRelease.id,
				packageSize: BigInt(input.packageSize),
				createdById: actorId,
			},
			update: {
				packageKey: input.packageKey,
				packageSha256: input.packageSha256,
				packageSize: BigInt(input.packageSize),
				signature: input.signature,
				plan: input.plan,
				anchors: input.anchors,
				status: 'DRAFT',
				createdById: actorId,
			},
		})
		await enqueuePostCommitEvent(tx, 'release.created', {
			resourceId: migration.id,
			kind: 'client-migration',
			actorId,
		})
		return migration
	})

export const publishClientMigration = async (id: string, actorId: string) =>
	prisma.$transaction(async (tx) => {
		const migration = await tx.clientMigration.findUnique({ where: { id } })
		if (!migration) throw createApiError(404, 'MIGRATION_NOT_FOUND')
		await tx.clientRelease.updateMany({
			where: { id: { in: [migration.fromReleaseId, migration.toReleaseId] } },
			data: { status: 'PUBLISHED', publishedAt: new Date() },
		})
		const published = await tx.clientMigration.update({
			where: { id },
			data: { status: 'PUBLISHED', publishedAt: new Date() },
		})
		await enqueuePostCommitEvent(tx, 'migration.published', {
			resourceId: id,
			actorId,
		})
		return published
	})

export const nextClientMigration = async (
	currentVersion: string,
	canUseProtectedSource: boolean,
	sourceKey?: string,
) => {
	const migration = await nextMigrationRecord(currentVersion)
	if (!migration) return null
	const sources = await prisma.distributionSource.findMany({
		where: { enabled: true },
		orderBy: { priority: 'asc' },
		select: { key: true, baseUrl: true, policy: true },
	})
	const orderedSources = sourceKey
		? [
				...sources.filter((source) => source.key === sourceKey),
				...sources.filter((source) => source.key !== sourceKey),
			]
		: sources
	const packageUrls = orderedSources.flatMap((source) =>
		sourceDelivery(source.policy) === 'edgeone'
			? canUseProtectedSource
				? [
						resolveDeliveryUrl(
							source.baseUrl,
							migration.packageKey,
							source.policy,
						),
					]
				: []
			: [`${source.baseUrl.replace(/\/$/, '')}/${migration.packageKey}`],
	)
	if (!packageUrls.length)
		throw createApiError(401, 'PROTECTED_SOURCE_AUTHENTICATION_REQUIRED')
	return {
		migrationId: migration.id,
		fromVersion: currentVersion,
		toVersion: migration.toRelease.version,
		packageKey: migration.packageKey,
		packageUrls,
		packageSha256: migration.packageSha256,
		packageSize: migration.packageSize.toString(),
		signature: migration.signature,
		plan: withMigrationAnchors(migration.plan, migration.anchors),
		anchors: migration.anchors,
	}
}
