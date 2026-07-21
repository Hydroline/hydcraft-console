import { requireAdministrator } from '../../utils/auth/session'
import { prisma } from '../../utils/db/prisma'
export default defineEventHandler(async (event) => {
	await requireAdministrator(event)
	const config = useRuntimeConfig()
	const [tokens, policy] = await Promise.all([
		prisma.publishToken.findMany({
			select: {
				id: true,
				name: true,
				scopes: true,
				expiresAt: true,
				revokedAt: true,
				lastUsedAt: true,
				createdAt: true,
			},
			orderBy: { createdAt: 'desc' },
		}),
		prisma.consolePolicy.findUnique({ where: { id: 'default' } }),
	])
	return {
		tokens,
		policy,
		configuration: {
			database: Boolean(config.databaseUrl),
			oidc: Boolean(config.hydrolineIssuer && config.oidcClientId),
			sourceSecretEncryptionConfigured: Boolean(
				config.sourceSecretEncryptionKey,
			),
		},
	}
})
