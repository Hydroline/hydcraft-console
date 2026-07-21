import { z } from 'zod'
import { nextClientMigration } from '../../../utils/client-updates/service'
import { optionalIdentity } from '../../../utils/auth/session'

const query = z.object({
	currentVersion: z.string().regex(/^\d+\.\d+\.\d+\.\d+$/),
	channel: z
		.string()
		.regex(/^[a-z0-9-]+$/)
		.default('stable'),
})

export default defineEventHandler(async (event) => {
	const input = query.parse(getQuery(event))
	return nextClientMigration(
		input.channel,
		input.currentVersion,
		Boolean(await optionalIdentity(event)),
	)
})
