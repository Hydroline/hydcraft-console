import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import { prisma } from '../../utils/db/prisma'
import { createApiError } from '../../utils/errors'
import { hashToken } from '../../utils/auth/session'

const schema = z.object({ refreshToken: z.string().min(32) })
const ACCESS_TOKEN_TTL_SECONDS = 15 * 60
const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60

export default defineEventHandler(async (event) => {
	const { refreshToken } = schema.parse(await readBody(event))
	const now = new Date()
	const nextAccessToken = randomBytes(48).toString('base64url')
	const nextRefreshToken = randomBytes(48).toString('base64url')
	const accessExpiresAt = new Date(
		now.getTime() + ACCESS_TOKEN_TTL_SECONDS * 1000,
	)
	const refreshExpiresAt = new Date(
		now.getTime() + REFRESH_TOKEN_TTL_SECONDS * 1000,
	)

	const bundle = await prisma.$transaction(async (tx) => {
		const current = await tx.desktopRefreshToken.findUnique({
			where: { tokenHash: hashToken(refreshToken) },
		})
		if (!current) return null

		const consumed = await tx.desktopRefreshToken.updateMany({
			where: {
				id: current.id,
				revokedAt: null,
				expiresAt: { gt: now },
			},
			data: { revokedAt: now, lastUsedAt: now },
		})
		if (consumed.count !== 1) {
			await tx.desktopRefreshToken.updateMany({
				where: { familyId: current.familyId, revokedAt: null },
				data: { revokedAt: now },
			})
			return null
		}

		await tx.consoleSession.create({
			data: {
				tokenHash: hashToken(nextAccessToken),
				subjectId: current.subjectId,
				expiresAt: accessExpiresAt,
			},
		})
		await tx.desktopRefreshToken.create({
			data: {
				tokenHash: hashToken(nextRefreshToken),
				familyId: current.familyId,
				subjectId: current.subjectId,
				expiresAt: refreshExpiresAt,
			},
		})

		return {
			accessToken: nextAccessToken,
			expiresIn: ACCESS_TOKEN_TTL_SECONDS,
			refreshToken: nextRefreshToken,
			refreshExpiresIn: REFRESH_TOKEN_TTL_SECONDS,
		}
	})

	if (!bundle) throw createApiError(401, 'DESKTOP_REFRESH_TOKEN_INVALID')
	return bundle
})
