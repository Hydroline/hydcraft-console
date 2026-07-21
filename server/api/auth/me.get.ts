import { optionalIdentity } from '../../utils/auth/session'

export default defineEventHandler(async (event) => ({
	identity: await optionalIdentity(event),
}))
