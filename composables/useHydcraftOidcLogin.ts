interface OidcLoginResponse {
	authorizationUrl: string
}

export const useHydcraftOidcLogin = () => {
	const { t } = useI18n()
	const toast = useToast()
	const isStartingOidcLogin = ref(false)

	const startOidcLogin = async (): Promise<void> => {
		if (isStartingOidcLogin.value) return

		isStartingOidcLogin.value = true
		try {
			const { authorizationUrl } = await $fetch<OidcLoginResponse>(
				'/api/oidc/hydcraft/login?response=json',
			)
			window.location.assign(authorizationUrl)
		} catch {
			toast.add({
				title: t('auth.oidcFailedTitle'),
				description: t('auth.oidcErrors.discoveryUnavailable'),
				color: 'error',
				icon: 'i-lucide-circle-alert',
			})
			isStartingOidcLogin.value = false
		}
	}

	return { isStartingOidcLogin, startOidcLogin }
}
