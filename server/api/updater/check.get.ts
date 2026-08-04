import { z } from 'zod'
import {
	checkClientMigration,
	clientTestEntitlement,
} from '../../utils/client-updates/service'
import { optionalIdentity } from '../../utils/auth/session'

const query = z.object({
	currentVersion: z.string().regex(/^\d+\.\d+\.\d+(?:\.\d+)?$/),
})

export default defineEventHandler(async (event) => {
	const input = query.parse(getQuery(event))
	const identity = await optionalIdentity(event)
	return checkClientMigration(
		input.currentVersion,
		Boolean(identity?.entitlements.includes(clientTestEntitlement)),
	)
})
