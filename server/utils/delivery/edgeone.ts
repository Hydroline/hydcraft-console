import {
	createCipheriv,
	createDecipheriv,
	createHash,
	randomBytes,
} from 'node:crypto'

export type SourceDelivery = 'public' | 'edgeone'

interface EdgeonePrivateConfig {
	signingKeyEncrypted: string
	authParam: string
	tokenLifetime: number
}

export interface EdgeonePolicyInput {
	signingKey?: string
	authParam?: string
	tokenLifetime?: number
}

interface EdgeoneSourcePolicy {
	sourceDelivery: 'edgeone'
	edgeone: EdgeonePrivateConfig
}

const encryptedValueVersion = 'v1'
const defaultAuthParam = 'token'
const defaultTokenLifetime = 3600

const encryptionKey = (): Buffer => {
	const value = useRuntimeConfig().sourceSecretEncryptionKey
	const key = Buffer.from(value, 'base64')
	if (key.length !== 32)
		throw createError({
			statusCode: 503,
			statusMessage: 'SOURCE_SECRET_ENCRYPTION_UNAVAILABLE',
		})
	return key
}

const encrypt = (value: string): string => {
	const iv = randomBytes(12)
	const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
	const ciphertext = Buffer.concat([
		cipher.update(value, 'utf8'),
		cipher.final(),
	])
	return [
		encryptedValueVersion,
		iv.toString('base64url'),
		cipher.getAuthTag().toString('base64url'),
		ciphertext.toString('base64url'),
	].join('.')
}

const decrypt = (value: string): string => {
	const [version, iv, authTag, ciphertext] = value.split('.')
	if (version !== encryptedValueVersion || !iv || !authTag || !ciphertext)
		throw createError({
			statusCode: 500,
			statusMessage: 'SOURCE_SECRET_INVALID',
		})
	const decipher = createDecipheriv(
		'aes-256-gcm',
		encryptionKey(),
		Buffer.from(iv, 'base64url'),
	)
	decipher.setAuthTag(Buffer.from(authTag, 'base64url'))
	return Buffer.concat([
		decipher.update(Buffer.from(ciphertext, 'base64url')),
		decipher.final(),
	]).toString('utf8')
}

export const sourceDelivery = (policy: unknown): SourceDelivery =>
	policy &&
	typeof policy === 'object' &&
	'sourceDelivery' in policy &&
	(policy as { sourceDelivery?: unknown }).sourceDelivery === 'edgeone'
		? 'edgeone'
		: 'public'

const edgeonePolicy = (policy: unknown): EdgeoneSourcePolicy => {
	if (
		sourceDelivery(policy) !== 'edgeone' ||
		!policy ||
		typeof policy !== 'object' ||
		!('edgeone' in policy)
	)
		throw createError({
			statusCode: 503,
			statusMessage: 'EDGEONE_SOURCE_CONFIGURATION_UNAVAILABLE',
		})
	const edgeone = (policy as { edgeone?: unknown }).edgeone
	if (
		!edgeone ||
		typeof edgeone !== 'object' ||
		typeof (edgeone as EdgeonePrivateConfig).signingKeyEncrypted !== 'string'
	)
		throw createError({
			statusCode: 503,
			statusMessage: 'EDGEONE_SOURCE_CONFIGURATION_UNAVAILABLE',
		})
	return policy as EdgeoneSourcePolicy
}

export const createEdgeonePolicy = (
	input: EdgeonePolicyInput,
	existingPolicy?: unknown,
): EdgeoneSourcePolicy => {
	const existing =
		sourceDelivery(existingPolicy) === 'edgeone'
			? edgeonePolicy(existingPolicy).edgeone
			: undefined
	const signingKeyEncrypted = input.signingKey
		? encrypt(input.signingKey)
		: existing?.signingKeyEncrypted
	if (!signingKeyEncrypted)
		throw createError({
			statusCode: 400,
			statusMessage: 'EDGEONE_SIGNING_KEY_REQUIRED',
		})
	return {
		sourceDelivery: 'edgeone',
		edgeone: {
			signingKeyEncrypted,
			authParam: input.authParam ?? existing?.authParam ?? defaultAuthParam,
			tokenLifetime:
				input.tokenLifetime ?? existing?.tokenLifetime ?? defaultTokenLifetime,
		},
	}
}

export const publicSourcePolicy = () => ({ sourceDelivery: 'public' as const })

export const sourcePolicyForAdministrator = (policy: unknown) => {
	if (sourceDelivery(policy) !== 'edgeone') return publicSourcePolicy()
	const edgeone = edgeonePolicy(policy).edgeone
	return {
		sourceDelivery: 'edgeone' as const,
		edgeoneConfigured: true,
		authParam: edgeone.authParam,
		tokenLifetime: edgeone.tokenLifetime,
	}
}

export const resolveDeliveryUrl = (
	baseUrl: string,
	key: string,
	policy: unknown,
) => {
	const edgeone = edgeonePolicy(policy).edgeone
	const path = `/${key.split('/').map(encodeURIComponent).join('/')}`
	const expiration = Math.floor(Date.now() / 1000) + edgeone.tokenLifetime
	const random = randomBytes(12).toString('base64url')
	const signature = createHash('md5')
		.update(
			`${path}-${expiration}-${random}-0-${decrypt(edgeone.signingKeyEncrypted)}`,
		)
		.digest('hex')
	const url = new URL(path, baseUrl)
	url.searchParams.set(
		edgeone.authParam,
		`${expiration}-${random}-0-${signature}`,
	)
	return url.toString()
}
