import { renderPclHomepage } from '../../../../utils/pcl-homepage/service'

const firstQueryValue = (value: unknown) =>
	Array.isArray(value) ? value[0] : typeof value === 'string' ? value : ''

const getBareQueryKey = (event: Parameters<typeof getQuery>[0]) => {
	const rawQuery = getRequestURL(event).search.slice(1)
	const bareKey = rawQuery
		.split('&')
		.find((part) => part.length > 0 && !part.includes('='))
	if (!bareKey) return ''

	try {
		return decodeURIComponent(bareKey.replace(/\+/g, ' '))
	} catch {
		return ''
	}
}

export default defineEventHandler(async (event) => {
	const query = getQuery(event)
	const identifier =
		firstQueryValue(query.server) ||
		firstQueryValue(query.oxygen) ||
		getBareQueryKey(event)
	setResponseHeader(event, 'content-type', 'application/xml; charset=utf-8')
	setResponseHeader(event, 'cache-control', 'no-store')
	return renderPclHomepage(identifier)
})
