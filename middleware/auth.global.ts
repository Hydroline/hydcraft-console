export default defineNuxtRouteMiddleware(async (to) => {
	if (to.meta.public === true || to.path === '/signed-out') return
	const { data, error } = await useFetch('/api/auth/me')
	const identity = data.value?.identity
	if (error.value || !identity) return navigateTo('/', { replace: true })
	if (!['ADMIN', 'OWNER'].includes(identity.role.toUpperCase()))
		return navigateTo('/', { replace: true })
})
