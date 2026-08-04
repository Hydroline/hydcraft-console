import { randomUUID } from 'node:crypto'
import { prisma } from '../db/prisma'
import { createApiError } from '../errors'
import { enqueuePostCommitEvent } from '../events/post-commit'
import { resolveDeliveryUrl, sourceDelivery } from '../delivery/edgeone'
import type {
	ClientMigrationInput,
	ClientReleaseEditorialInput,
	ClientReleaseInput,
} from './contracts'
import type { PortalDirectoryUser } from '../portal/directory'

export const clientTestEntitlement = 'client-test'

type LocalizedLabels = Record<string, unknown>

export interface UpdaterVersion {
	version: string
	label: string
	isLatest: boolean
	isBase: boolean
	publishedAt: string | null
	changelog: string | null
	apiVersion: string | null
	modCount: number
	mods: UpdaterMod[]
	publisher: UpdaterContributor | null
	contributors: UpdaterContributor[]
	fullPackage: UpdaterFullPackage | null
}

export interface UpdaterContributor {
	hydrolineId: string
	username: string
	displayName: string | null
	avatarUrl: string | null
}

export interface UpdaterFullPackage {
	packageKey: string
	packageSha256: string
	packageSize: number
	signature: string
	signaturePayload?: 'sha256'
}

export interface UpdaterFullPackageDownload extends UpdaterFullPackage {
	sources: string[]
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
	baseUrl: string
	priority: number
	isDefault: boolean
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

const contributorFromManifest = (value: unknown): UpdaterContributor | null => {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return null
	const item = value as Record<string, unknown>
	if (typeof item.hydrolineId !== 'string' || typeof item.username !== 'string')
		return null
	return {
		hydrolineId: item.hydrolineId,
		username: item.username,
		displayName: typeof item.displayName === 'string' ? item.displayName : null,
		avatarUrl: typeof item.avatarUrl === 'string' ? item.avatarUrl : null,
	}
}

const contributorsFromManifest = (value: unknown) =>
	Array.isArray(value)
		? value
				.map(contributorFromManifest)
				.filter((item): item is UpdaterContributor => Boolean(item))
		: []

const fullPackageFromManifest = (
	manifest: Record<string, unknown>,
	version: string,
) => {
	const base = manifest.base
	const baseMatchesRelease =
		base &&
		typeof base === 'object' &&
		!Array.isArray(base) &&
		typeof (base as Record<string, unknown>).packageKey === 'string' &&
		(base as Record<string, unknown>).packageKey.startsWith(
			`client/stable/base/${version}/`,
		)
	const candidate = manifest.fullPackage ?? (baseMatchesRelease ? base : null)
	if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate))
		return null
	const item = candidate as Record<string, unknown>
	if (
		typeof item.packageKey !== 'string' ||
		typeof item.packageSha256 !== 'string' ||
		typeof item.packageSize !== 'number' ||
		typeof item.signature !== 'string'
	)
		return null
	return {
		packageKey: item.packageKey,
		packageSha256: item.packageSha256,
		packageSize: item.packageSize,
		signature: item.signature,
		...(item.signaturePayload === 'sha256'
			? { signaturePayload: 'sha256' as const }
			: {}),
	}
}

const nextMigrationRecord = async (
	currentVersion: string,
	canUseTestCandidate = false,
) => {
	const fromRelease = await prisma.clientRelease.findFirst({
		where: { version: currentVersion, status: 'PUBLISHED' },
		orderBy: { publishedAt: 'desc' },
	})
	if (!fromRelease) return null
	return prisma.clientMigration.findFirst({
		where: {
			fromReleaseId: fromRelease.id,
			OR: [
				{ status: 'PUBLISHED' },
				...(canUseTestCandidate
					? [{ status: 'DRAFT', candidateState: 'TESTING' as const }]
					: []),
			],
		},
		include: { toRelease: true },
		orderBy: { updatedAt: 'asc' },
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
			isBase: Boolean(
				fullPackageFromManifest(manifest, release.version) &&
				!manifest.fullPackage,
			),
			publishedAt: release.publishedAt?.toISOString() ?? null,
			changelog:
				typeof manifest.changelog === 'string' ? manifest.changelog : null,
			apiVersion:
				typeof metadata.apiVersion === 'string' ? metadata.apiVersion : null,
			modCount: mods.length,
			mods,
			publisher: contributorFromManifest(manifest.publisher),
			contributors: contributorsFromManifest(manifest.contributors),
			fullPackage: fullPackageFromManifest(manifest, release.version),
		}
	})
}

export const listUpdaterSources = async (
	canUseProtectedSource: boolean,
	locale = 'zh-CN',
): Promise<UpdaterSource[]> => {
	const sources = await prisma.distributionSource.findMany({
		where: { enabled: true, scope: 'CLIENT' },
		orderBy: { priority: 'asc' },
		select: {
			key: true,
			labels: true,
			baseUrl: true,
			priority: true,
			isDefault: true,
			policy: true,
		},
	})
	return sources.map((source) => {
		const requiresLogin = sourceDelivery(source.policy) === 'edgeone'
		return {
			key: source.key,
			label: localizedLabel(source.labels, locale) || source.key,
			baseUrl: source.baseUrl,
			priority: source.priority,
			isDefault: source.isDefault,
			requiresLogin,
			available: !requiresLogin || canUseProtectedSource,
		}
	})
}

export const resolveUpdaterSourceProbeTarget = async (
	key: string,
): Promise<UpdaterSourceProbeTarget | null> => {
	const source = await prisma.distributionSource.findFirst({
		where: { key, enabled: true, scope: 'CLIENT' },
		select: { baseUrl: true, policy: true },
	})
	if (!source) return null
	return {
		baseUrl: source.baseUrl,
		requiresLogin: sourceDelivery(source.policy) === 'edgeone',
	}
}

export const checkClientMigration = async (
	currentVersion: string,
	canUseTestCandidate = false,
) => {
	const migration = await nextMigrationRecord(
		currentVersion,
		canUseTestCandidate,
	)
	return {
		currentVersion,
		updateAvailable: Boolean(migration),
		toVersion: migration?.toRelease.version ?? currentVersion,
		migrationId: migration?.id ?? null,
		...(migration?.candidateState === 'TESTING'
			? { testRevision: migration.candidateRevision }
			: {}),
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

const toManifestContributor = (
	user: PortalDirectoryUser,
): UpdaterContributor => ({
	hydrolineId: user.hydrolineId,
	username: user.username,
	displayName: user.displayName,
	avatarUrl: user.avatarUrl,
})

export const updateClientReleaseEditorial = async (
	id: string,
	input: ClientReleaseEditorialInput,
	people: PortalDirectoryUser[],
	actorId: string,
) =>
	prisma.$transaction(async (tx) => {
		const release = await tx.clientRelease.findUnique({ where: { id } })
		if (!release) throw createApiError(404, 'CLIENT_RELEASE_NOT_FOUND')
		const manifest =
			release.manifest && typeof release.manifest === 'object'
				? { ...(release.manifest as Record<string, unknown>) }
				: {}
		const peopleById = new Map(
			people.map((person) => [
				person.hydrolineId,
				toManifestContributor(person),
			]),
		)
		if (input.changelog !== undefined) manifest.changelog = input.changelog
		if (input.publisherHydrolineId !== undefined)
			manifest.publisher = input.publisherHydrolineId
				? (peopleById.get(input.publisherHydrolineId) ?? null)
				: null
		if (input.contributorHydrolineIds !== undefined)
			manifest.contributors = input.contributorHydrolineIds.map((hydrolineId) =>
				peopleById.get(hydrolineId)!,
			)
		const updated = await tx.clientRelease.update({
			where: { id },
			data: { manifest },
		})
		await enqueuePostCommitEvent(tx, 'audit.log', {
			action: 'UPDATED',
			resource: 'client-release',
			resourceId: id,
			actorId,
		})
		return updated
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

const resolvePackageSources = async (
	packageKey: string,
	canUseProtectedSource: boolean,
	sourceKey?: string,
	protectedOnly = false,
) => {
	const sources = await prisma.distributionSource.findMany({
		where: { enabled: true, scope: 'CLIENT' },
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
				? [resolveDeliveryUrl(source.baseUrl, packageKey, source.policy)]
				: []
			: protectedOnly
				? []
				: [`${source.baseUrl.replace(/\/$/, '')}/${packageKey}`],
	)
	if (!packageUrls.length)
		throw createApiError(
			protectedOnly ? 503 : 401,
			protectedOnly
				? 'CANDIDATE_PRIVATE_SOURCE_UNAVAILABLE'
				: 'PROTECTED_SOURCE_AUTHENTICATION_REQUIRED',
		)
	return packageUrls
}

export const getPublishedClientFullPackage = async (
	version: string,
	canUseProtectedSource: boolean,
	sourceKey?: string,
): Promise<UpdaterFullPackageDownload> => {
	const release = await prisma.clientRelease.findFirst({
		where: { version, status: 'PUBLISHED' },
		select: { manifest: true, version: true },
	})
	if (!release) throw createApiError(404, 'CLIENT_RELEASE_NOT_FOUND')
	const manifest =
		release.manifest && typeof release.manifest === 'object'
			? (release.manifest as Record<string, unknown>)
			: {}
	const fullPackage = fullPackageFromManifest(manifest, release.version)
	if (!fullPackage)
		throw createApiError(404, 'PUBLISHED_CLIENT_FULL_PACKAGE_NOT_FOUND')
	return {
		...fullPackage,
		sources: await resolvePackageSources(
			fullPackage.packageKey,
			canUseProtectedSource,
			sourceKey,
		),
	}
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
		const existingMigration = await tx.clientMigration.findUnique({
			where: {
				fromReleaseId_toReleaseId: {
					fromReleaseId: fromRelease.id,
					toReleaseId: toRelease.id,
				},
			},
		})
		if (existingMigration?.status === 'PUBLISHED')
			throw createApiError(409, 'CLIENT_MIGRATION_IMMUTABLE')
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
				candidateState: null,
				candidateEntitlement: null,
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

const candidateMigration = async (
	tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
	fromVersion: string,
	toVersion: string,
) => {
	const migration = await tx.clientMigration.findFirst({
		where: {
			fromRelease: { version: fromVersion },
			toRelease: { version: toVersion },
		},
	})
	if (!migration) throw createApiError(404, 'CANDIDATE_MIGRATION_NOT_FOUND')
	if (migration.status === 'PUBLISHED')
		throw createApiError(409, 'CANDIDATE_ALREADY_PUBLISHED')
	return migration
}

export const prepareClientMigrationCandidate = async (
	input: ClientMigrationInput,
	actorId?: string,
) => {
	return prisma.$transaction(async (tx) => {
		const [fromRelease, toRelease] = await Promise.all([
			tx.clientRelease.findUnique({ where: { version: input.fromVersion } }),
			tx.clientRelease.findUnique({ where: { version: input.toVersion } }),
		])
		if (!fromRelease || !toRelease)
			throw createApiError(400, 'MIGRATION_RELEASE_NOT_FOUND')
		const existing = await tx.clientMigration.findUnique({
			where: {
				fromReleaseId_toReleaseId: {
					fromReleaseId: fromRelease.id,
					toReleaseId: toRelease.id,
				},
			},
		})
		if (existing?.status === 'PUBLISHED')
			throw createApiError(409, 'CANDIDATE_ALREADY_PUBLISHED')
		const prepared = existing
			? await tx.clientMigration.update({
					where: { id: existing.id },
					data: {
						candidateState: 'UPLOADING',
						candidateEntitlement: clientTestEntitlement,
					},
				})
			: await tx.clientMigration.create({
					data: {
						id: randomUUID(),
						fromReleaseId: fromRelease.id,
						toReleaseId: toRelease.id,
						packageKey: input.packageKey,
						packageSha256: input.packageSha256,
						packageSize: BigInt(input.packageSize),
						signature: input.signature,
						plan: input.plan,
						anchors: input.anchors,
						candidateState: 'UPLOADING',
						candidateEntitlement: clientTestEntitlement,
						createdById: actorId,
					},
				})
		await enqueuePostCommitEvent(tx, 'audit.log', {
			action: 'UPDATED',
			resource: 'client-migration-candidate',
			resourceId: prepared.id,
			actorId,
			payload: { state: 'UPLOADING' },
		})
		return prepared
	})
}

export const completeClientMigrationCandidate = async (
	input: ClientMigrationInput,
	actorId?: string,
) =>
	prisma.$transaction(async (tx) => {
		const migration = await candidateMigration(
			tx,
			input.fromVersion,
			input.toVersion,
		)
		if (migration.candidateState !== 'UPLOADING')
			throw createApiError(409, 'CANDIDATE_NOT_UPLOADING')
		const revision = migration.candidateRevision + 1
		const updated = await tx.clientMigration.update({
			where: { id: migration.id },
			data: {
				packageKey: input.packageKey,
				packageSha256: input.packageSha256,
				packageSize: BigInt(input.packageSize),
				signature: input.signature,
				plan: input.plan,
				anchors: input.anchors,
				candidateState: 'TESTING',
				candidateRevision: revision,
				candidateEntitlement: clientTestEntitlement,
			},
		})
		await tx.clientMigrationRevision.create({
			data: {
				migrationId: migration.id,
				revision,
				packageKey: input.packageKey,
				packageSha256: input.packageSha256,
				packageSize: BigInt(input.packageSize),
				signature: input.signature,
				plan: input.plan,
				anchors: input.anchors,
			},
		})
		await enqueuePostCommitEvent(tx, 'audit.log', {
			action: 'UPDATED',
			resource: 'client-migration-candidate',
			resourceId: updated.id,
			actorId,
			payload: { state: 'TESTING', revision },
		})
		return updated
	})

export const prepareClientMigrationCandidateRevocation = async (
	fromVersion: string,
	toVersion: string,
	_actorId?: string,
) =>
	prisma.$transaction(async (tx) => {
		const migration = await candidateMigration(tx, fromVersion, toVersion)
		if (!migration.candidateState)
			throw createApiError(409, 'CANDIDATE_NOT_ACTIVE')
		return tx.clientMigration.update({
			where: { id: migration.id },
			data: { candidateState: 'REVOKING' },
		})
	})

export const completeClientMigrationCandidateRevocation = async (
	fromVersion: string,
	toVersion: string,
	actorId?: string,
) =>
	prisma.$transaction(async (tx) => {
		const migration = await candidateMigration(tx, fromVersion, toVersion)
		if (migration.candidateState !== 'REVOKING')
			throw createApiError(409, 'CANDIDATE_NOT_REVOKING')
		const targetId = migration.toReleaseId
		await tx.clientMigration.delete({ where: { id: migration.id } })
		const remaining = await tx.clientMigration.count({
			where: { OR: [{ fromReleaseId: targetId }, { toReleaseId: targetId }] },
		})
		const target = await tx.clientRelease.findUnique({
			where: { id: targetId },
		})
		if (target?.status === 'DRAFT' && remaining === 0)
			await tx.clientRelease.delete({ where: { id: targetId } })
		await enqueuePostCommitEvent(tx, 'audit.log', {
			action: 'REVOKED',
			resource: 'client-migration-candidate',
			resourceId: migration.id,
			actorId,
		})
		return { id: migration.id }
	})

export const publishClientMigration = async (id: string, actorId: string) =>
	prisma.$transaction(async (tx) => {
		const migration = await tx.clientMigration.findUnique({ where: { id } })
		if (!migration) throw createApiError(404, 'MIGRATION_NOT_FOUND')
		if (
			migration.candidateState === 'UPLOADING' ||
			migration.candidateState === 'REVOKING'
		)
			throw createApiError(409, 'CANDIDATE_NOT_READY_TO_PUBLISH')
		await tx.clientRelease.updateMany({
			where: { id: { in: [migration.fromReleaseId, migration.toReleaseId] } },
			data: { status: 'PUBLISHED', publishedAt: new Date() },
		})
		const published = await tx.clientMigration.update({
			where: { id },
			data: {
				status: 'PUBLISHED',
				publishedAt: new Date(),
				candidateState: null,
				candidateEntitlement: null,
			},
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
	canUseTestCandidate = false,
) => {
	const migration = await nextMigrationRecord(
		currentVersion,
		canUseTestCandidate,
	)
	if (!migration) return null
	const isTestCandidate = migration.candidateState === 'TESTING'
	const packageUrls = await resolvePackageSources(
		migration.packageKey,
		isTestCandidate ? canUseTestCandidate : canUseProtectedSource,
		sourceKey,
		isTestCandidate,
	)
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
		...(isTestCandidate
			? { testRevision: migration.candidateRevision, channel: 'test' as const }
			: { channel: 'stable' as const }),
	}
}
