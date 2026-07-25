import { z } from 'zod'
import {
	canUseProtectedSource,
	optionalIdentity,
} from '../../../../utils/auth/session'
import { getPublishedClientFullPackage } from '../../../../utils/client-updates/service'

const query = z.object({
	sourceKey: z
		.string()
		.regex(/^[a-z0-9-]+$/)
		.optional(),
})

export default defineEventHandler(async (event) => {
	const input = query.parse(getQuery(event))
	const version = z
		.string()
		.regex(/^\d+\.\d+\.\d+(?:\.\d+)?$/)
		.parse(getRouterParam(event, 'version'))
	return getPublishedClientFullPackage(
		version,
		canUseProtectedSource(await optionalIdentity(event)),
		input.sourceKey,
	)
})
