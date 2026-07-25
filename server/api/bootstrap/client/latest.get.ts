import { z } from 'zod'
import { getPublishedClientBase } from '../../../utils/client-updates/service'

const query = z.object({
	clientId: z.string().min(1),
})

export default defineEventHandler(async (event) =>
	getPublishedClientBase(query.parse(getQuery(event)).clientId),
)
