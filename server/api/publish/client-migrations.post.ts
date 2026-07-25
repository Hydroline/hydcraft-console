import { createHash } from 'node:crypto'
import { prisma } from '../../utils/db/prisma'
import { createApiError } from '../../utils/errors'
import { clientMigrationSchema } from '../../utils/client-updates/contracts'
import { createClientMigration } from '../../utils/client-updates/service'

export default defineEventHandler(async (event) => {
	const token = getHeader(event, 'authorization')?.replace(/^Bearer\s+/i, '')
	if (!token) throw createApiError(401, 'PUBLISH_TOKEN_REQUIRED')
	const credential = await prisma.publishToken.findFirst({
		where: {
			tokenHash: createHash('sha256').update(token).digest('hex'),
			revokedAt: null,
			OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
		},
	})
	if (!credential?.scopes.includes('CLIENT'))
		throw createApiError(403, 'PUBLISH_TOKEN_SCOPE_FORBIDDEN')
	const migration = await createClientMigration(
		clientMigrationSchema.parse(await readBody(event)),
	)
	await prisma.publishToken.update({
		where: { id: credential.id },
		data: { lastUsedAt: new Date() },
	})
	return { ...migration, packageSize: Number(migration.packageSize) }
})
