import { requireAdministrator } from '../../utils/auth/session'
import {
	distributionInputSchema,
	saveDistribution,
} from '../../utils/distribution/service'

export default defineEventHandler(async (event) => {
	const actor = await requireAdministrator(event)
	return saveDistribution(
		distributionInputSchema.parse(await readBody(event)),
		actor.subjectId,
	)
})
