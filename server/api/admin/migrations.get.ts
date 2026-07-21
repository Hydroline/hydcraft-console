import { requireAdministrator } from '../../utils/auth/session'
import { prisma } from '../../utils/db/prisma'

export default defineEventHandler(async (event) => {
	await requireAdministrator(event)
	return prisma.clientMigration.findMany({
		include: { fromRelease: true, toRelease: true },
		orderBy: { updatedAt: 'desc' },
		take: 100,
	})
})
