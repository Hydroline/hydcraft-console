import { requireAdministrator } from '../../../../utils/auth/session'
import { publishRevision } from '../../../../utils/releases/service'

export default defineEventHandler(async (event) => {
	const actor = await requireAdministrator(event)
	return publishRevision(getRouterParam(event, 'id') ?? '', actor.subjectId)
})
