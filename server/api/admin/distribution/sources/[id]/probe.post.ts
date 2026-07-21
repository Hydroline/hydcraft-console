import { requireAdministrator } from '../../../../../utils/auth/session'
import { prisma } from '../../../../../utils/db/prisma'
import { createApiError } from '../../../../../utils/errors'

export default defineEventHandler(async (event) => {
	await requireAdministrator(event)
	const source = await prisma.distributionSource.findUnique({
		where: { id: getRouterParam(event, 'id') ?? '' },
	})
	if (!source) throw createApiError(404, 'SOURCE_NOT_FOUND')
	const response = await fetch(source.baseUrl, {
		method: 'HEAD',
		headers: { range: 'bytes=0-0' },
		signal: AbortSignal.timeout(10_000),
	})
	return {
		ok: response.ok || response.status === 206,
		status: response.status,
		acceptRanges: response.headers.get('accept-ranges'),
	}
})
