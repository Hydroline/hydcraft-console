import { createHash } from 'node:crypto'
import { z } from 'zod'
import { prisma } from '../../../../utils/db/prisma'
import { createApiError } from '../../../../utils/errors'
import { completeClientMigrationCandidateRevocation } from '../../../../utils/client-updates/service'

const schema = z.object({ fromVersion: z.string(), toVersion: z.string() })

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
	const input = schema.parse(await readBody(event))
	const result = await completeClientMigrationCandidateRevocation(
		input.fromVersion,
		input.toVersion,
	)
	await prisma.publishToken.update({
		where: { id: credential.id },
		data: { lastUsedAt: new Date() },
	})
	return result
})
