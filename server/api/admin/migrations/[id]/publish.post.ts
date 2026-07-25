import { requireAdministrator } from '../../../../utils/auth/session'
import { publishClientMigration } from '../../../../utils/client-updates/service'

export default defineEventHandler(async (event) => {
	const migration = await publishClientMigration(
		getRouterParam(event, 'id') ?? '',
		(await requireAdministrator(event)).subjectId,
	)
	return { ...migration, packageSize: Number(migration.packageSize) }
})
