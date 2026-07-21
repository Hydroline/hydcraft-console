import { prisma } from '../db/prisma'
import { createApiError } from '../errors'
import { enqueuePostCommitEvent } from '../events/post-commit'
import { resolveDeliveryUrl, sourceDelivery } from '../delivery/edgeone'
import type { ClientMigrationInput, ClientReleaseInput } from './contracts'

export const createClientRelease = async (
	input: ClientReleaseInput,
	actorId?: string,
) =>
	prisma.$transaction(async (tx) => {
		const release = await tx.clientRelease.upsert({
			where: {
				channel_version: { channel: input.channel, version: input.version },
			},
			create: { ...input, createdById: actorId },
			update: {
				manifest: input.manifest,
			},
		})
		await enqueuePostCommitEvent(tx, 'release.created', {
			resourceId: release.id,
			kind: 'client-release',
			actorId,
		})
		return release
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
				where: {
					channel_version: {
						channel: input.channel,
						version: input.fromVersion,
					},
				},
			}),
			tx.clientRelease.findUnique({
				where: {
					channel_version: { channel: input.channel, version: input.toVersion },
				},
			}),
		])
		if (!fromRelease || !toRelease)
			throw createApiError(400, 'MIGRATION_RELEASE_NOT_FOUND')
		const migration = await tx.clientMigration.upsert({
			where: {
				channel_fromReleaseId_toReleaseId: {
					channel: input.channel,
					fromReleaseId: fromRelease.id,
					toReleaseId: toRelease.id,
				},
			},
			create: {
				...input,
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
	channel: string,
	currentVersion: string,
	canUseProtectedSource: boolean,
) => {
	const fromRelease = await prisma.clientRelease.findUnique({
		where: { channel_version: { channel, version: currentVersion } },
	})
	if (!fromRelease) throw createApiError(404, 'CLIENT_VERSION_NOT_FOUND')
	const migration = await prisma.clientMigration.findFirst({
		where: { channel, fromReleaseId: fromRelease.id, status: 'PUBLISHED' },
		include: { toRelease: true },
		orderBy: { publishedAt: 'asc' },
	})
	if (!migration) return null
	const sources = await prisma.distributionSource.findMany({
		where: { enabled: true },
		orderBy: { priority: 'asc' },
		select: { baseUrl: true, policy: true },
	})
	const packageUrls = sources.flatMap((source) =>
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
		plan: migration.plan,
		anchors: migration.anchors,
	}
}
