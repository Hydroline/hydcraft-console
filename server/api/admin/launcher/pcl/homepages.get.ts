import { requireAdministrator } from '../../../../utils/auth/session'
import { listPclHomepageServers } from '../../../../utils/pcl-homepage/service'

export default defineEventHandler(async (event) => {
	await requireAdministrator(event)
	return { servers: await listPclHomepageServers() }
})
