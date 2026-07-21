import { createHash, randomBytes } from 'node:crypto'
import { z } from 'zod'
import { requireAdministrator } from '../../../utils/auth/session'
import { prisma } from '../../../utils/db/prisma'
const schema = z.object({
	name: z.string().min(1).max(80),
	scopes: z.array(z.enum(['CLIENT', 'UPDATER'])).min(1),
	expiresAt: z.string().datetime().optional(),
})
export default defineEventHandler(async (event) => {
	const actor = await requireAdministrator(event)
	const input = schema.parse(await readBody(event))
	const token = `hcpt_${randomBytes(32).toString('base64url')}`
	const record = await prisma.publishToken.create({
		data: {
			name: input.name,
			prefix: token.slice(0, 13),
			tokenHash: createHash('sha256').update(token).digest('hex'),
			scopes: input.scopes,
			expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
			createdById: actor.subjectId,
		},
	})
	return { id: record.id, token }
})
