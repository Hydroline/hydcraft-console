import { requireAdministrator } from '../../../../../utils/auth/session'
import { prisma } from '../../../../../utils/db/prisma'
export default defineEventHandler(async (event) => {
	await requireAdministrator(event)
	await prisma.publishToken.update({
		where: { id: getRouterParam(event, 'id') ?? '' },
		data: { revokedAt: new Date() },
	})
	return { ok: true }
})
