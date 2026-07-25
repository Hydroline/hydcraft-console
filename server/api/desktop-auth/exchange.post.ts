import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import { prisma } from '../../utils/db/prisma'
import { createApiError } from '../../utils/errors'
import { hashToken } from '../../utils/auth/session'

const schema = z.object({ code: z.string().min(32) })
const ACCESS_TOKEN_TTL_SECONDS = 15 * 60
const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60

export default defineEventHandler(async (event) => {
	const { code } = schema.parse(await readBody(event))
	const now = new Date()
	const accessToken = randomBytes(48).toString('base64url')
	const refreshToken = randomBytes(48).toString('base64url')
	const familyId = randomBytes(24).toString('base64url')
	const accessExpiresAt = new Date(
		now.getTime() + ACCESS_TOKEN_TTL_SECONDS * 1000,
	)
	const refreshExpiresAt = new Date(
		now.getTime() + REFRESH_TOKEN_TTL_SECONDS * 1000,
	)

	return await prisma.$transaction(async (tx) => {
		const record = await tx.desktopAuthorizationCode.findFirst({
			where: {
				codeHash: hashToken(code),
				consumedAt: null,
				expiresAt: { gt: now },
			},
		})
		if (!record) throw createApiError(401, 'DESKTOP_AUTHORIZATION_CODE_INVALID')
		const consumed = await tx.desktopAuthorizationCode.updateMany({
			where: { id: record.id, consumedAt: null, expiresAt: { gt: now } },
			data: { consumedAt: now },
		})
		if (consumed.count !== 1)
			throw createApiError(401, 'DESKTOP_AUTHORIZATION_CODE_INVALID')

		await tx.consoleSession.create({
			data: {
				tokenHash: hashToken(accessToken),
				subjectId: record.subjectId,
				expiresAt: accessExpiresAt,
			},
		})
		await tx.desktopRefreshToken.create({
			data: {
				tokenHash: hashToken(refreshToken),
				familyId,
				subjectId: record.subjectId,
				expiresAt: refreshExpiresAt,
			},
		})

		return {
			accessToken,
			expiresIn: ACCESS_TOKEN_TTL_SECONDS,
			refreshToken,
			refreshExpiresIn: REFRESH_TOKEN_TTL_SECONDS,
		}
	})
})
