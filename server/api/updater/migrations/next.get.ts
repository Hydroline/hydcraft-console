import { z } from 'zod'
import {
	clientTestEntitlement,
	nextClientMigration,
} from '../../../utils/client-updates/service'
import {
	canUseProtectedSource,
	optionalIdentity,
} from '../../../utils/auth/session'

const query = z.object({
	currentVersion: z.string().regex(/^\d+\.\d+\.\d+(?:\.\d+)?$/),
	sourceKey: z
		.string()
		.regex(/^[a-z0-9-]+$/)
		.optional(),
})

export default defineEventHandler(async (event) => {
	const input = query.parse(getQuery(event))
	const identity = await optionalIdentity(event)
	return nextClientMigration(
		input.currentVersion,
		canUseProtectedSource(identity),
		input.sourceKey,
		Boolean(identity?.entitlements.includes(clientTestEntitlement)),
	)
})
