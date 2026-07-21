import { requireAdministrator } from '../../utils/auth/session'
import { prisma } from '../../utils/db/prisma'
import { sourcePolicyForAdministrator } from '../../utils/delivery/edgeone'

export default defineEventHandler(async (event) => {
	await requireAdministrator(event)
	const [sources, categories, entitlements] = await Promise.all([
		prisma.distributionSource.findMany({
			orderBy: [{ priority: 'asc' }, { key: 'asc' }],
		}),
		prisma.addonCategory.findMany({ orderBy: { key: 'asc' } }),
		prisma.entitlementDefinition.findMany({ orderBy: { key: 'asc' } }),
	])
	return {
		sources: sources.map((source) => ({
			...source,
			policy: sourcePolicyForAdministrator(source.policy),
		})),
		categories,
		entitlements,
	}
})
