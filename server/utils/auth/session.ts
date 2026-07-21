import {
	createCipheriv,
	createDecipheriv,
	createHash,
	randomBytes,
} from 'node:crypto'
import { prisma } from '../db/prisma'
import { createApiError } from '../errors'
import { discoverOidc } from '../oidc'

const CONSOLE_SESSION_TTL_SECONDS = 30 * 24 * 60 * 60
const ACCESS_TOKEN_REFRESH_LEEWAY_SECONDS = 60

interface ConsoleSessionTokenBundle {
	portalAccessToken: string
	portalAccessTokenExpiresAt: Date
	portalRefreshToken: string
	portalRefreshTokenExpiresAt: Date
}

interface PortalTokenResponse {
	access_token?: string
	refresh_token?: string
	expires_in?: number
	refresh_token_expires_in?: number
}

const portalRefreshInFlight = new Map<string, Promise<string>>()

export interface ConsoleIdentity {
	subjectId: string
	hydrolineId: string
	username: string
	displayName: string | null
	avatarUrl: string | null
	role: string
	locale: string
	entitlements: string[]
}

const hashToken = (value: string) =>
	createHash('sha256').update(value).digest('hex')

const encryptionKey = () =>
	createHash('sha256').update(String(useRuntimeConfig().sessionSecret)).digest()
const seal = (value: string) => {
	const iv = randomBytes(12)
	const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
	const encrypted = Buffer.concat([
		cipher.update(value, 'utf8'),
		cipher.final(),
	])
	return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}`
}
const unseal = (value: string) => {
	const [iv, tag, encrypted] = value.split('.')
	if (!iv || !tag || !encrypted) return null
	try {
		const decipher = createDecipheriv(
			'aes-256-gcm',
			encryptionKey(),
			Buffer.from(iv, 'base64url'),
		)
		decipher.setAuthTag(Buffer.from(tag, 'base64url'))
		return Buffer.concat([
			decipher.update(Buffer.from(encrypted, 'base64url')),
			decipher.final(),
		]).toString('utf8')
	} catch {
		return null
	}
}

export const createConsoleSession = async (
	subjectId: string,
	lifetimeSeconds = 900,
	tokens?: Partial<ConsoleSessionTokenBundle>,
) => {
	const token = randomBytes(48).toString('base64url')
	await prisma.consoleSession.create({
		data: {
			tokenHash: hashToken(token),
			subjectId,
			portalAccessToken: tokens?.portalAccessToken
				? seal(tokens.portalAccessToken)
				: null,
			portalAccessTokenExpiresAt: tokens?.portalAccessTokenExpiresAt,
			portalRefreshToken: tokens?.portalRefreshToken
				? seal(tokens.portalRefreshToken)
				: null,
			portalRefreshTokenExpiresAt: tokens?.portalRefreshTokenExpiresAt,
			expiresAt: new Date(Date.now() + lifetimeSeconds * 1000),
		},
	})
	return token
}

export const revokeConsoleSession = async (token: string) => {
	await prisma.consoleSession.updateMany({
		where: { tokenHash: hashToken(token), revokedAt: null },
		data: { revokedAt: new Date() },
	})
}

export const resolveConsoleIdentity = async (
	token: string,
): Promise<ConsoleIdentity | null> => {
	const session = await prisma.consoleSession.findFirst({
		where: {
			tokenHash: hashToken(token),
			revokedAt: null,
			expiresAt: { gt: new Date() },
		},
		include: {
			subject: {
				include: { entitlements: { include: { entitlement: true } } },
			},
		},
	})
	if (!session) return null
	return {
		subjectId: session.subject.id,
		hydrolineId: session.subject.hydrolineId,
		username: session.subject.username,
		displayName: session.subject.displayName,
		avatarUrl: session.subject.avatarUrl,
		role: session.subject.role,
		locale: session.subject.locale,
		entitlements: session.subject.entitlements
			.filter((grant) => grant.entitlement.enabled)
			.map((grant) => grant.entitlement.key),
	}
}

export const optionalIdentity = async (
	event: Parameters<typeof getCookie>[0],
) => {
	const token =
		getCookie(event, 'hydcraft_console_session') ??
		getHeader(event, 'authorization')?.replace(/^Bearer\s+/i, '')
	return token ? resolveConsoleIdentity(token) : null
}

export const requireAdministrator = async (
	event: Parameters<typeof getCookie>[0],
) => {
	const identity = await optionalIdentity(event)
	if (!identity) throw createApiError(401, 'AUTHENTICATION_REQUIRED')
	if (!['ADMIN', 'OWNER'].includes(identity.role))
		throw createApiError(403, 'ADMIN_ROLE_REQUIRED')
	return identity
}

export const requirePortalAccessToken = async (
	event: Parameters<typeof getCookie>[0],
) => {
	const token = getCookie(event, 'hydcraft_console_session')
	if (!token) throw createApiError(401, 'AUTHENTICATION_REQUIRED')
	const session = await prisma.consoleSession.findFirst({
		where: {
			tokenHash: hashToken(token),
			revokedAt: null,
			expiresAt: { gt: new Date() },
		},
	})
	const accessToken = session?.portalAccessToken
		? unseal(session.portalAccessToken)
		: null
	if (!session || !accessToken)
		throw createApiError(401, 'OIDC_REAUTHENTICATION_REQUIRED')
	const refreshToken = session.portalRefreshToken
		? unseal(session.portalRefreshToken)
		: null
	const shouldRefresh =
		!session.portalAccessTokenExpiresAt ||
		session.portalAccessTokenExpiresAt.getTime() <=
			Date.now() + ACCESS_TOKEN_REFRESH_LEEWAY_SECONDS * 1000
	if (!shouldRefresh) return accessToken
	if (
		!refreshToken ||
		(session.portalRefreshTokenExpiresAt?.getTime() ?? 0) <= Date.now()
	)
		throw createApiError(401, 'OIDC_REAUTHENTICATION_REQUIRED')

	const existingRefresh = portalRefreshInFlight.get(session.tokenHash)
	if (existingRefresh) return existingRefresh

	const refreshPromise = (async () => {
		const config = useRuntimeConfig()
		const discovery = await discoverOidc(String(config.hydrolineIssuer))
		const response = await fetch(discovery.token_endpoint, {
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({
				grant_type: 'refresh_token',
				refresh_token: refreshToken,
				client_id: String(config.oidcClientId),
				client_secret: String(config.oidcClientSecret),
			}),
		})
		if (!response.ok)
			throw createApiError(401, 'OIDC_REAUTHENTICATION_REQUIRED')
		const refreshed = (await response.json()) as PortalTokenResponse
		if (!refreshed.access_token || !refreshed.expires_in)
			throw createApiError(401, 'OIDC_REAUTHENTICATION_REQUIRED')
		const refreshedAccessExpiresAt = new Date(
			Date.now() + refreshed.expires_in * 1000,
		)
		const nextRefreshToken = refreshed.refresh_token ?? refreshToken
		const nextRefreshExpiresAt = new Date(
			Date.now() +
				(refreshed.refresh_token_expires_in ??
					(session.portalRefreshTokenExpiresAt
						? Math.max(
								1,
								Math.floor(
									(session.portalRefreshTokenExpiresAt.getTime() - Date.now()) /
										1000,
								),
							)
						: CONSOLE_SESSION_TTL_SECONDS)) *
					1000,
		)
		await prisma.consoleSession.update({
			where: { id: session.id },
			data: {
				portalAccessToken: seal(refreshed.access_token),
				portalAccessTokenExpiresAt: refreshedAccessExpiresAt,
				portalRefreshToken: seal(nextRefreshToken),
				portalRefreshTokenExpiresAt: nextRefreshExpiresAt,
				expiresAt: new Date(Date.now() + CONSOLE_SESSION_TTL_SECONDS * 1000),
			},
		})
		return refreshed.access_token
	})().finally(() => portalRefreshInFlight.delete(session.tokenHash))
	portalRefreshInFlight.set(session.tokenHash, refreshPromise)
	return refreshPromise
}
