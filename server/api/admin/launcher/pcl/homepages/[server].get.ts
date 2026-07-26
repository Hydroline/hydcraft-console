import { requireAdministrator } from '../../../../../utils/auth/session'
import { getPclHomepageEditor } from '../../../../../utils/pcl-homepage/service'

export default defineEventHandler(async (event) => {
	await requireAdministrator(event)
	return getPclHomepageEditor(getRouterParam(event, 'server') ?? '')
})
