import { requireAdministrator } from '../../utils/auth/session'
import { ensureClientTestEntitlement } from '../../utils/client-updates/service'
import { prisma } from '../../utils/db/prisma'
import { sourcePolicyForAdministrator } from '../../utils/delivery/edgeone'

export default defineEventHandler(async (event) => {
	await requireAdministrator(event)
	await ensureClientTestEntitlement()
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
