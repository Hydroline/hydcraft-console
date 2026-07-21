import { z } from 'zod'
import { requireAdministrator } from '../../../utils/auth/session'
import { updateDraftRevision } from '../../../utils/releases/service'

const schema = z.object({ manifest: z.unknown() })

export default defineEventHandler(async (event) => {
	const actor = await requireAdministrator(event)
	const input = schema.parse(await readBody(event))
	return updateDraftRevision(
		getRouterParam(event, 'id') ?? '',
		input.manifest,
		actor.subjectId,
	)
})
