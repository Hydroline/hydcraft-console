import { requireAdministrator } from '../../utils/auth/session'
import { prisma } from '../../utils/db/prisma'
export default defineEventHandler(async (event) => {
	await requireAdministrator(event)
	return prisma.auditLog.findMany({
		include: { actor: { select: { username: true, hydrolineId: true } } },
		orderBy: { createdAt: 'desc' },
		take: 200,
	})
})
