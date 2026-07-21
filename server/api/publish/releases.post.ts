import { createHash } from 'node:crypto'
import { z } from 'zod'
import { prisma } from '../../utils/db/prisma'
import { createApiError } from '../../utils/errors'
import { createDraftRevision } from '../../utils/releases/service'

const schema = z.object({
	kind: z.literal('UPDATER'),
	version: z.string(),
	manifest: z.unknown(),
})

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
	const input = schema.parse(await readBody(event))
	if (!credential.scopes.includes(input.kind)) {
		throw createApiError(403, 'PUBLISH_TOKEN_SCOPE_FORBIDDEN')
	}
	const release = await createDraftRevision({ ...input })
	await prisma.publishToken.update({
		where: { id: credential.id },
		data: { lastUsedAt: new Date() },
	})
	return release
})
