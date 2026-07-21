import { removeDistribution } from '../../../../utils/distribution/service'
import { requireAdministrator } from '../../../../utils/auth/session'
import { createApiError } from '../../../../utils/errors'

export default defineEventHandler(async (event) => {
	const actor = await requireAdministrator(event)
	const type = getRouterParam(event, 'type')
	if (!['source', 'category', 'entitlement'].includes(type ?? ''))
		throw createApiError(400, 'DISTRIBUTION_TYPE_INVALID')
	const id = getRouterParam(event, 'id')
	if (!id) throw createApiError(400, 'DISTRIBUTION_ID_REQUIRED')
	return removeDistribution(
		type as 'source' | 'category' | 'entitlement',
		id,
		actor.subjectId,
	)
})
