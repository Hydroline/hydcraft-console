import { z } from 'zod'
import { prisma } from '../db/prisma'
import { createApiError } from '../errors'
import { enqueuePostCommitEvent } from '../events/post-commit'
import {
	createEdgeonePolicy,
	publicSourcePolicy,
	type EdgeonePolicyInput,
} from '../delivery/edgeone'

const labels = z.object({
	'zh-CN': z.string().min(1),
	'zh-TW': z.string().optional(),
	'ja-JP': z.string().optional(),
	'en-US': z.string().optional(),
})
const categoryPath = z
	.string()
	.min(1)
	.refine(
		(value) =>
			!value.startsWith('/') &&
			!value.includes('\\') &&
			!value.split('/').includes('..'),
		'DISTRIBUTION_PATH_INVALID',
	)

const sourcePolicyInputSchema = z.discriminatedUnion('sourceDelivery', [
	z.object({ sourceDelivery: z.literal('public') }),
	z.object({
		sourceDelivery: z.literal('edgeone'),
		edgeone: z.object({
			signingKey: z.string().min(1).max(4096).optional(),
			authParam: z.string().min(1).max(64).optional(),
			tokenLifetime: z.number().int().min(60).max(86_400).optional(),
		}),
	}),
])

const sourceScope = z.enum(['CLIENT', 'UPDATER'])

export const distributionInputSchema = z.discriminatedUnion('type', [
	z.object({
		type: z.literal('source'),
		key: z.string().regex(/^[a-z0-9-]+$/),
		labels,
		baseUrl: z.string().url(),
		scope: sourceScope.default('CLIENT'),
		priority: z.number().int(),
		isDefault: z.boolean().default(false),
		enabled: z.boolean(),
		policy: sourcePolicyInputSchema.default({ sourceDelivery: 'public' }),
	}),
	z.object({
		type: z.literal('entitlement'),
		key: z.string().regex(/^[a-z0-9-]+$/),
		labels,
		description: labels.optional(),
		enabled: z.boolean(),
	}),
	z.object({
		type: z.literal('category'),
		key: z.string().regex(/^[a-z0-9-]+$/),
		labels,
		description: labels.optional(),
		installTarget: categoryPath,
		realDirectory: categoryPath.optional(),
		entitlementMode: z.enum(['ANY', 'ALL']),
		entitlements: z.array(z.string()),
		sourceIds: z.array(z.string()),
		enabled: z.boolean(),
	}),
])

export type DistributionInput = z.infer<typeof distributionInputSchema>

const audit = (
	action: 'CREATED' | 'UPDATED' | 'REVOKED',
	resource: string,
	resourceId: string,
	actorId: string,
	payload?: Record<string, unknown>,
) => ({ action, resource, resourceId, actorId, payload })

export const saveDistribution = async (
	input: DistributionInput,
	actorId: string,
) =>
	prisma.$transaction(async (tx) => {
		if (input.type === 'source') {
			const isDefault = input.scope === 'CLIENT' && input.isDefault
			if (isDefault) {
				await tx.distributionSource.updateMany({
					where: { isDefault: true, key: { not: input.key } },
					data: { isDefault: false },
				})
			}
			const existing = await tx.distributionSource.findUnique({
				where: { key: input.key },
				select: { policy: true },
			})
			const policy =
				input.policy.sourceDelivery === 'edgeone'
					? createEdgeonePolicy(
							input.policy.edgeone as EdgeonePolicyInput,
							existing?.policy,
						)
					: publicSourcePolicy()
			const source = await tx.distributionSource.upsert({
				where: { key: input.key },
				create: {
					key: input.key,
					labels: input.labels,
					baseUrl: input.baseUrl,
					scope: input.scope,
					priority: input.priority,
					isDefault,
					enabled: input.enabled,
					policy,
				},
				update: {
					labels: input.labels,
					baseUrl: input.baseUrl,
					scope: input.scope,
					priority: input.priority,
					isDefault,
					enabled: input.enabled,
					policy,
				},
			})
			await enqueuePostCommitEvent(
				tx,
				'audit.log',
				audit('UPDATED', 'distribution-source', source.id, actorId),
			)
			return source
		}
		if (input.type === 'entitlement') {
			const entitlement = await tx.entitlementDefinition.upsert({
				where: { key: input.key },
				create: {
					key: input.key,
					labels: input.labels,
					description: input.description,
					enabled: input.enabled,
				},
				update: {
					labels: input.labels,
					description: input.description,
					enabled: input.enabled,
				},
			})
			await enqueuePostCommitEvent(
				tx,
				'audit.log',
				audit('UPDATED', 'entitlement-definition', entitlement.id, actorId),
			)
			return entitlement
		}
		const [definitions, sources] = await Promise.all([
			tx.entitlementDefinition.count({
				where: { key: { in: input.entitlements }, enabled: true },
			}),
			tx.distributionSource.count({
				where: {
					id: { in: input.sourceIds },
					enabled: true,
					scope: 'CLIENT',
				},
			}),
		])
		if (definitions !== input.entitlements.length)
			throw createApiError(400, 'ENTITLEMENT_REFERENCE_INVALID')
		if (sources !== input.sourceIds.length)
			throw createApiError(400, 'SOURCE_REFERENCE_INVALID')
		const category = await tx.addonCategory.upsert({
			where: { key: input.key },
			create: {
				key: input.key,
				labels: input.labels,
				description: input.description,
				installTarget: input.installTarget,
				realDirectory: input.realDirectory,
				entitlementMode: input.entitlementMode,
				entitlements: input.entitlements,
				sourceIds: input.sourceIds,
				enabled: input.enabled,
			},
			update: {
				labels: input.labels,
				description: input.description,
				installTarget: input.installTarget,
				realDirectory: input.realDirectory,
				entitlementMode: input.entitlementMode,
				entitlements: input.entitlements,
				sourceIds: input.sourceIds,
				enabled: input.enabled,
			},
		})
		await enqueuePostCommitEvent(
			tx,
			'audit.log',
			audit('UPDATED', 'addon-category', category.id, actorId),
		)
		return category
	})

export const removeDistribution = async (
	type: DistributionInput['type'],
	id: string,
	actorId: string,
) =>
	prisma.$transaction(async (tx) => {
		const model =
			type === 'source'
				? tx.distributionSource
				: type === 'category'
					? tx.addonCategory
					: tx.entitlementDefinition
		const record = await model.delete({ where: { id } })
		await enqueuePostCommitEvent(
			tx,
			'audit.log',
			audit('REVOKED', `distribution-${type}`, record.id, actorId),
		)
		return record
	})
