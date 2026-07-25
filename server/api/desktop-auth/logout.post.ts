import { z } from 'zod'
import { prisma } from '../../utils/db/prisma'
import { hashToken } from '../../utils/auth/session'

const schema = z.object({ refreshToken: z.string().min(32) })

export default defineEventHandler(async (event) => {
	const { refreshToken } = schema.parse(await readBody(event))
	const token = await prisma.desktopRefreshToken.findUnique({
		where: { tokenHash: hashToken(refreshToken) },
	})
	if (!token) return { revoked: false }
	await prisma.desktopRefreshToken.updateMany({
		where: { familyId: token.familyId, revokedAt: null },
		data: { revokedAt: new Date() },
	})
	return { revoked: true }
})
