import { prisma } from '../../utils/db/prisma'
import { requireAdministrator } from '../../utils/auth/session'

export default defineEventHandler(async (event) => {
	await requireAdministrator(event)
	return prisma.releaseRevision.findMany({
		orderBy: [{ updatedAt: 'desc' }],
		take: 100,
	})
})
