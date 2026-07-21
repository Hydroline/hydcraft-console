import { getPublishedManifest } from '../../../utils/releases/service'

export default defineEventHandler(async (event) => {
	const platform = getQuery(event).platform
	if (platform !== 'windows-x86_64' && platform !== 'macos-universal') {
		throw createError({
			statusCode: 400,
			statusMessage: 'UPDATER_PLATFORM_INVALID',
		})
	}
	return getPublishedManifest('UPDATER', platform)
})
