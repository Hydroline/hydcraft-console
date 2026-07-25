import { z } from 'zod'
import {
	canUseProtectedSource,
	optionalIdentity,
} from '../../utils/auth/session'
import { listUpdaterSources } from '../../utils/client-updates/service'

const query = z.object({
	locale: z
		.string()
		.regex(/^[a-z]{2}-[A-Z]{2}$/)
		.default('zh-CN'),
})

export default defineEventHandler(async (event) => {
	const input = query.parse(getQuery(event))
	const identity = await optionalIdentity(event)
	return listUpdaterSources(canUseProtectedSource(identity), input.locale)
})
