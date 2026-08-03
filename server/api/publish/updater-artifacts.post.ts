import { createHash } from 'node:crypto'
import { prisma } from '../../utils/db/prisma'
import { createApiError } from '../../utils/errors'
import { updaterArtifactInputSchema } from '../../utils/releases/contracts'
import { registerUpdaterArtifact } from '../../utils/releases/service'

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
	if (!credential) throw createApiError(401, 'PUBLISH_TOKEN_INVALID')
	if (!credential.scopes.includes('UPDATER'))
		throw createApiError(403, 'PUBLISH_TOKEN_SCOPE_FORBIDDEN')

	const input = updaterArtifactInputSchema.parse(await readBody(event))
	const result = await registerUpdaterArtifact(input)
	await prisma.publishToken.update({
		where: { id: credential.id },
		data: { lastUsedAt: new Date() },
	})
	return result
})
