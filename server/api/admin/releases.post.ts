import { z } from 'zod'
import { requireAdministrator } from '../../utils/auth/session'
import { createDraftRevision } from '../../utils/releases/service'

const schema = z.object({
	kind: z.literal('UPDATER'),
	version: z.string(),
	manifest: z.unknown(),
})
export default defineEventHandler(async (event) => {
	const actor = await requireAdministrator(event)
	const input = schema.parse(await readBody(event))
	return createDraftRevision({ ...input, actorId: actor.subjectId })
})
