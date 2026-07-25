import { requireAdministrator } from '../../../../utils/auth/session'
import { publishClientRelease } from '../../../../utils/client-updates/service'

export default defineEventHandler(async (event) =>
	publishClientRelease(
		getRouterParam(event, 'id') ?? '',
		(await requireAdministrator(event)).subjectId,
	),
)
