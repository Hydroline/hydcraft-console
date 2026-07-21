import { createHash, randomBytes } from 'node:crypto'

interface OidcDiscovery {
	authorization_endpoint: string
	token_endpoint: string
	userinfo_endpoint?: string
}

export function pkceVerifier() {
	return randomBytes(48).toString('base64url')
}
export function pkceChallenge(verifier: string) {
	return createHash('sha256').update(verifier).digest('base64url')
}

export async function discoverOidc(issuer: string): Promise<OidcDiscovery> {
	const response = await fetch(
		new URL(
			'.well-known/openid-configuration',
			issuer.endsWith('/') ? issuer : `${issuer}/`,
		),
	)
	if (response.status === 404) {
		const base = issuer.replace(/\/$/, '')
		return {
			authorization_endpoint: `${base}/oauth/authorize`,
			token_endpoint: `${base}/api/oauth/token`,
			userinfo_endpoint: `${base}/api/oauth/userinfo`,
		}
	}
	if (!response.ok)
		throw createError({
			statusCode: 502,
			statusMessage: 'OIDC discovery failed',
		})
	return (await response.json()) as OidcDiscovery
}

export function encodeIdentity(identity: {
	subject: string
	roles: string[]
	entitlements: string[]
}) {
	return Buffer.from(JSON.stringify(identity)).toString('base64url')
}
