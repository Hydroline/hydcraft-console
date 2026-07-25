import {
	canUseProtectedSource,
	optionalIdentity,
} from '../../../../utils/auth/session'
import { createApiError } from '../../../../utils/errors'
import { resolveUpdaterSourceProbeTarget } from '../../../../utils/client-updates/service'

export default defineEventHandler(async (event) => {
	const key = getRouterParam(event, 'key')
	if (!key) throw createApiError(404, 'DOWNLOAD_SOURCE_NOT_FOUND')
	const target = await resolveUpdaterSourceProbeTarget(key)
	if (!target) throw createApiError(404, 'DOWNLOAD_SOURCE_NOT_FOUND')
	if (target.requiresLogin) {
		const identity = await optionalIdentity(event)
		if (!canUseProtectedSource(identity)) {
			throw createApiError(403, 'DOWNLOAD_SOURCE_PROTECTED')
		}
	}
	return sendRedirect(event, target.baseUrl, 307)
})
