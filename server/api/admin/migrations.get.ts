import { requireAdministrator } from '../../utils/auth/session'
import { prisma } from '../../utils/db/prisma'

export default defineEventHandler(async (event) => {
	await requireAdministrator(event)
	const migrations = await prisma.clientMigration.findMany({
		include: {
			fromRelease: true,
			toRelease: true,
			candidateRevisions: {
				select: { revision: true, packageSha256: true, createdAt: true },
				orderBy: { revision: 'desc' },
			},
		},
		orderBy: { updatedAt: 'desc' },
		take: 100,
	})
	return migrations.map((migration) => ({
		...migration,
		packageSize: Number(migration.packageSize),
	}))
})
