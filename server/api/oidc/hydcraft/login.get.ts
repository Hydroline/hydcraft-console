import { createHash, randomBytes } from 'node:crypto'
import { prisma } from '../../../utils/db/prisma'
import { createApiError } from '../../../utils/errors'
import { discoverOidc, pkceChallenge, pkceVerifier } from '../../../utils/oidc'

export default defineEventHandler(async (event) => {
	const config = useRuntimeConfig()
	const desktopRedirectUri =
		typeof getQuery(event).desktop_redirect_uri === 'string'
			? getQuery(event).desktop_redirect_uri
			: undefined
	if (
		desktopRedirectUri &&
		desktopRedirectUri !== `${config.updaterDesktopScheme}://auth/callback`
	)
		throw createApiError(400, 'DESKTOP_REDIRECT_URI_INVALID')
	const state = randomBytes(32).toString('base64url')
	const verifier = pkceVerifier()
	await prisma.oidcLoginAttempt.create({
		data: {
			stateHash: createHash('sha256').update(state).digest('hex'),
			codeVerifier: verifier,
			returnTo: desktopRedirectUri ?? '/',
			expiresAt: new Date(Date.now() + 10 * 60 * 1000),
		},
	})
	const discovery = await discoverOidc(String(config.hydrolineIssuer))
	const authorizationUrl = new URL(discovery.authorization_endpoint)
	authorizationUrl.searchParams.set('response_type', 'code')
	authorizationUrl.searchParams.set('client_id', String(config.oidcClientId))
	authorizationUrl.searchParams.set(
		'redirect_uri',
		String(config.oidcRedirectUri),
	)
	authorizationUrl.searchParams.set(
		'scope',
		desktopRedirectUri
			? 'profile hydroline email'
			: 'profile hydroline email directory.read',
	)
	authorizationUrl.searchParams.set('state', state)
	authorizationUrl.searchParams.set('code_challenge', pkceChallenge(verifier))
	authorizationUrl.searchParams.set('code_challenge_method', 'S256')
	return sendRedirect(event, authorizationUrl.toString())
})
