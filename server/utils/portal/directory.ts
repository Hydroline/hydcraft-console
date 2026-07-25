import { createApiError } from '../errors'

export interface PortalDirectoryUser {
	id: string
	hydrolineId: string
	username: string
	displayName: string | null
	avatarUrl: string | null
	role: string
}

interface PortalDirectoryResponse {
	items: PortalDirectoryUser[]
}

export const resolvePortalDirectoryUsers = async (
	accessToken: string,
	hydrolineIds: string[],
): Promise<PortalDirectoryUser[]> => {
	const distinctIds = [...new Set(hydrolineIds)]
	const issuer = String(useRuntimeConfig().hydrolineIssuer).replace(/\/$/, '')
	const users = await Promise.all(
		distinctIds.map(async (hydrolineId) => {
			const target = new URL(`${issuer}/api/oauth/directory/users`)
			target.searchParams.set('q', hydrolineId)
			target.searchParams.set('page', '1')
			target.searchParams.set('pageSize', '50')
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
			const payload = (await response.json()) as PortalDirectoryResponse
			const user = payload.items.find(
				(item) => item.hydrolineId === hydrolineId,
			)
			if (!user) throw createApiError(400, 'PORTAL_DIRECTORY_USER_NOT_FOUND')
			return user
		}),
	)
	return hydrolineIds.map((hydrolineId) => {
		const user = users.find((item) => item.hydrolineId === hydrolineId)
		if (!user) throw createApiError(400, 'PORTAL_DIRECTORY_USER_NOT_FOUND')
		return user
	})
}
