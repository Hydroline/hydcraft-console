import { z } from 'zod'
import { checkClientMigration } from '../../utils/client-updates/service'

const query = z.object({
	currentVersion: z.string().regex(/^\d+\.\d+\.\d+(?:\.\d+)?$/),
})

export default defineEventHandler(async (event) => {
	const input = query.parse(getQuery(event))
	return checkClientMigration(input.currentVersion)
})
