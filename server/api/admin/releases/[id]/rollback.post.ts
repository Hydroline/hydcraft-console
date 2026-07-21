import { requireAdministrator } from '../../../../utils/auth/session'
import { rollbackRevision } from '../../../../utils/releases/service'

export default defineEventHandler(async (event) => {
	const actor = await requireAdministrator(event)
	return rollbackRevision(getRouterParam(event, 'id') ?? '', actor.subjectId)
})
