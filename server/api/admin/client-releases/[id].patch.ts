import {
	requireAdministrator,
	requirePortalAccessToken,
} from '../../../utils/auth/session'
import { updateClientReleaseEditorial } from '../../../utils/client-updates/service'
import { clientReleaseEditorialSchema } from '../../../utils/client-updates/contracts'
import { resolvePortalDirectoryUsers } from '../../../utils/portal/directory'

export default defineEventHandler(async (event) => {
	const actor = await requireAdministrator(event)
	const accessToken = await requirePortalAccessToken(event)
	const input = clientReleaseEditorialSchema.parse(await readBody(event))
	const hydrolineIds = [
		...(input.publisherHydrolineId ? [input.publisherHydrolineId] : []),
		...(input.contributorHydrolineIds ?? []),
	]
	const people = await resolvePortalDirectoryUsers(accessToken, hydrolineIds)
	return updateClientReleaseEditorial(
		getRouterParam(event, 'id') ?? '',
		input,
		people,
		actor.subjectId,
	)
})
