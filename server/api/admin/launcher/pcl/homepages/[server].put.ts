import { requireAdministrator } from '../../../../../utils/auth/session'
import { pclHomepageInputSchema } from '../../../../../utils/pcl-homepage/contracts'
import { savePclHomepage } from '../../../../../utils/pcl-homepage/service'

export default defineEventHandler(async (event) => {
	const actor = await requireAdministrator(event)
	return savePclHomepage(
		getRouterParam(event, 'server') ?? '',
		pclHomepageInputSchema.parse(await readBody(event)),
		actor.subjectId,
	)
})
