export default defineNuxtRouteMiddleware(async (to) => {
	if (to.meta.public === true) return
	const { data, error } = await useFetch('/api/auth/me')
	const identity = data.value?.identity
	if (error.value || !identity) return navigateTo('/', { replace: true })
	if (!['ADMIN', 'OWNER'].includes(identity.role.toUpperCase()))
		return navigateTo('/', { replace: true })
})
