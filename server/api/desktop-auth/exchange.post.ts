import { createHash } from 'node:crypto'
import { z } from 'zod'
import { prisma } from '../../utils/db/prisma'
import { createApiError } from '../../utils/errors'
import { createConsoleSession } from '../../utils/auth/session'

const schema = z.object({ code: z.string().min(32) })
export default defineEventHandler(async (event) => {
	const { code } = schema.parse(await readBody(event))
	const record = await prisma.desktopAuthorizationCode.findFirst({
		where: {
			codeHash: createHash('sha256').update(code).digest('hex'),
			consumedAt: null,
			expiresAt: { gt: new Date() },
		},
	})
	if (!record) throw createApiError(401, 'DESKTOP_AUTHORIZATION_CODE_INVALID')
	await prisma.desktopAuthorizationCode.update({
		where: { id: record.id },
		data: { consumedAt: new Date() },
	})
	return {
		accessToken: await createConsoleSession(record.subjectId),
		expiresIn: 900,
	}
})
