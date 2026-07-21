import {
	requireAdministrator,
	requirePortalAccessToken,
} from '../../utils/auth/session'
import { createApiError } from '../../utils/errors'

export default defineEventHandler(async (event) => {
	await requireAdministrator(event)
	const accessToken = await requirePortalAccessToken(event)
	const query = getQuery(event)
	const issuer = String(useRuntimeConfig().hydrolineIssuer).replace(/\/$/, '')
	const target = new URL(`${issuer}/api/oauth/directory/users`)
	if (typeof query.q === 'string') target.searchParams.set('q', query.q)
	target.searchParams.set(
		'page',
		typeof query.page === 'string' ? query.page : '1',
	)
	target.searchParams.set(
		'pageSize',
		typeof query.pageSize === 'string' ? query.pageSize : '20',
	)
	const response = await fetch(target, {
		headers: { authorization: `Bearer ${accessToken}` },
	})
	if (!response.ok)
		throw createApiError(
			response.status === 401 ? 401 : 502,
			response.status === 401
				? 'OIDC_REAUTHENTICATION_REQUIRED'
				: 'PORTAL_DIRECTORY_UNAVAILABLE',
		)
	return response.json()
})
