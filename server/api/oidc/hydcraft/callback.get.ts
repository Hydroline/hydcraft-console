import { createHash, randomBytes } from 'node:crypto'
import { prisma } from '../../../utils/db/prisma'
import { createApiError } from '../../../utils/errors'
import { discoverOidc } from '../../../utils/oidc'
import { createConsoleSession } from '../../../utils/auth/session'

const CONSOLE_SESSION_TTL_SECONDS = 30 * 24 * 60 * 60

interface OidcProfile {
	sub: string
	hydroline_id: string
	preferred_username?: string
	name?: string
	picture?: string | null
	role?: string
	status?: string
	locale?: string
}

type OidcFailureReason =
	| 'callback_invalid'
	| 'state_invalid'
	| 'token_exchange_failed'
	| 'userinfo_failed'
	| 'identity_invalid'
	| 'admin_role_required'
	| 'unexpected'

interface OidcCallbackError {
	data?: {
		code?: unknown
	}
}

const getFailureReason = (error: unknown): OidcFailureReason => {
	const code = (error as OidcCallbackError | undefined)?.data?.code
	switch (code) {
		case 'OIDC_CALLBACK_INVALID':
			return 'callback_invalid'
		case 'OIDC_STATE_INVALID':
			return 'state_invalid'
		case 'OIDC_TOKEN_EXCHANGE_FAILED':
			return 'token_exchange_failed'
		case 'OIDC_USERINFO_FAILED':
			return 'userinfo_failed'
		case 'OIDC_IDENTITY_INVALID':
			return 'identity_invalid'
		case 'ADMIN_ROLE_REQUIRED':
			return 'admin_role_required'
		default:
			return 'unexpected'
	}
}

export default defineEventHandler(async (event) => {
	try {
		const config = useRuntimeConfig()
		const query = getQuery(event)
		if (typeof query.code !== 'string' || typeof query.state !== 'string')
			throw createApiError(400, 'OIDC_CALLBACK_INVALID')
		const attempt = await prisma.oidcLoginAttempt.findFirst({
			where: {
				stateHash: createHash('sha256').update(query.state).digest('hex'),
				consumedAt: null,
				expiresAt: { gt: new Date() },
			},
		})
		if (!attempt) throw createApiError(400, 'OIDC_STATE_INVALID')
		await prisma.oidcLoginAttempt.update({
			where: { id: attempt.id },
			data: { consumedAt: new Date() },
		})
		const discovery = await discoverOidc(String(config.hydrolineIssuer))
		const tokenResponse = await fetch(discovery.token_endpoint, {
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({
				grant_type: 'authorization_code',
				code: query.code,
				redirect_uri: String(config.oidcRedirectUri),
				client_id: String(config.oidcClientId),
				client_secret: String(config.oidcClientSecret),
				code_verifier: attempt.codeVerifier,
			}),
		})
		if (!tokenResponse.ok || !discovery.userinfo_endpoint)
			throw createApiError(502, 'OIDC_TOKEN_EXCHANGE_FAILED')
		const token = (await tokenResponse.json()) as {
			access_token?: string
			refresh_token?: string
			expires_in?: number
			refresh_token_expires_in?: number
		}
		if (!token.access_token || !token.refresh_token)
			throw createApiError(502, 'OIDC_TOKEN_EXCHANGE_FAILED')
		const profileResponse = await fetch(discovery.userinfo_endpoint, {
			headers: { authorization: `Bearer ${token.access_token}` },
		})
		if (!profileResponse.ok) throw createApiError(502, 'OIDC_USERINFO_FAILED')
		const profile = (await profileResponse.json()) as OidcProfile
		if (!profile.sub || !profile.hydroline_id || profile.status !== 'ACTIVE')
			throw createApiError(403, 'OIDC_IDENTITY_INVALID')
		const isDesktop = attempt.returnTo.startsWith(
			`${config.updaterDesktopScheme}://`,
		)
		if (!isDesktop && !['ADMIN', 'OWNER'].includes(profile.role ?? ''))
			throw createApiError(403, 'ADMIN_ROLE_REQUIRED')
		const subject = await prisma.consoleSubject.upsert({
			where: { id: profile.sub },
			create: {
				id: profile.sub,
				hydrolineId: profile.hydroline_id,
				username: profile.preferred_username ?? profile.hydroline_id,
				displayName: profile.name,
				avatarUrl: profile.picture,
				role: profile.role ?? 'USER',
				locale: profile.locale ?? 'zh-CN',
			},
			update: {
				hydrolineId: profile.hydroline_id,
				username: profile.preferred_username ?? profile.hydroline_id,
				displayName: profile.name,
				avatarUrl: profile.picture,
				role: profile.role ?? 'USER',
				locale: profile.locale ?? 'zh-CN',
				lastSeenAt: new Date(),
			},
		})
		if (isDesktop) {
			const code = randomBytes(32).toString('base64url')
			await prisma.desktopAuthorizationCode.create({
				data: {
					codeHash: createHash('sha256').update(code).digest('hex'),
					subjectId: subject.id,
					redirectUri: attempt.returnTo,
					expiresAt: new Date(Date.now() + 60_000),
				},
			})
			return sendRedirect(
				event,
				`${attempt.returnTo}?code=${encodeURIComponent(code)}`,
			)
		}
		const session = await createConsoleSession(
			subject.id,
			CONSOLE_SESSION_TTL_SECONDS,
			{
				portalAccessToken: token.access_token,
				portalAccessTokenExpiresAt: new Date(
					Date.now() + (token.expires_in ?? 900) * 1000,
				),
				portalRefreshToken: token.refresh_token,
				portalRefreshTokenExpiresAt: new Date(
					Date.now() +
						(token.refresh_token_expires_in ?? CONSOLE_SESSION_TTL_SECONDS) *
							1000,
				),
			},
		)
		setCookie(event, 'hydcraft_console_session', session, {
			httpOnly: true,
			sameSite: 'lax',
			secure: !String(config.oidcRedirectUri).startsWith('http://localhost'),
			maxAge: CONSOLE_SESSION_TTL_SECONDS,
			path: '/',
		})
		return sendRedirect(event, '/releases')
	} catch (error) {
		return sendRedirect(event, `/?auth_error=${getFailureReason(error)}`)
	}
})
