import { requireAdministrator } from '../../../../utils/auth/session'
import { publishClientMigration } from '../../../../utils/client-updates/service'

export default defineEventHandler(async (event) =>
	publishClientMigration(
		getRouterParam(event, 'id') ?? '',
		(await requireAdministrator(event)).subjectId,
	),
)
