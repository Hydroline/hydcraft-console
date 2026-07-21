export default defineNuxtRouteMiddleware(async (to) => {
	if (to.meta.public === true || to.path === '/signed-out') return
	const { data, error } = await useFetch('/api/auth/me')
	if (error.value) return
	if (!data.value?.identity) return navigateTo('/', { replace: true })
	if (to.path === '/') return navigateTo('/releases')
})
