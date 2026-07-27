<script setup lang="ts">
definePageMeta({
	public: true,
})

const { t, locale } = useI18n()
const route = useRoute()
const toast = useToast()
const { data: me } = await useFetch('/api/auth/me')
const authenticated = computed(() => Boolean(me.value?.identity))
const { isStartingOidcLogin, startOidcLogin } = useHydcraftOidcLogin()

const oidcFailureMessages = {
	callback_invalid: 'auth.oidcErrors.callbackInvalid',
	state_invalid: 'auth.oidcErrors.stateInvalid',
	token_exchange_failed: 'auth.oidcErrors.tokenExchangeFailed',
	userinfo_failed: 'auth.oidcErrors.userinfoFailed',
	identity_invalid: 'auth.oidcErrors.identityInvalid',
	admin_role_required: 'auth.oidcErrors.adminRoleRequired',
	unexpected: 'auth.oidcErrors.unexpected',
} as const

onMounted(async () => {
	const failure = route.query.auth_error
	if (typeof failure !== 'string') return
	const messageKey =
		oidcFailureMessages[failure as keyof typeof oidcFailureMessages] ??
		oidcFailureMessages.unexpected

	toast.add({
		title: t('auth.oidcFailedTitle'),
		description: t(messageKey),
		color: 'error',
		icon: 'i-lucide-circle-alert',
	})

	const query = { ...route.query }
	delete query.auth_error
	await navigateTo({ path: route.path, query }, { replace: true })
})
</script>

<template>
	<div class="flex min-h-[calc(100vh-6rem)] flex-col justify-between">
		<section
			class="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center py-16 text-center sm:py-24"
		>
			<UIcon name="i-lucide-box" class="size-24" />
			<h1
				class="mt-4 text-3xl font-semibold tracking-tight text-slate-950 sm:text-5xl dark:text-white"
			>
				HydCraft Console
			</h1>
			<p
				v-if="locale !== 'en-US'"
				class="mt-1 text-lg text-slate-500 dark:text-slate-400 tracking-widest"
			>
				{{ t('home.subtitle') }}
			</p>

			<button
				v-if="!authenticated"
				type="button"
				class="group mt-10 w-full max-w-md cursor-pointer rounded-xl border border-slate-200 bg-white p-6 text-left shadow-sm transition-colors hover:bg-slate-900/80 hover:text-white dark:border-slate-800 dark:bg-slate-900"
				:disabled="isStartingOidcLogin"
				@click="startOidcLogin"
			>
				<div class="flex gap-3">
					<div
						class="grid size-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600 transition-colors group-hover:bg-slate-800 group-hover:text-slate-200 dark:bg-slate-800 dark:text-slate-300"
					>
						<UIcon name="i-lucide-shield-check" class="size-5" />
					</div>
					<div>
						<h2
							class="font-medium text-slate-900 transition-colors group-hover:text-white dark:text-white"
						>
							{{ t('home.loginTitle') }}
						</h2>
						<p
							class="mt-1 text-sm leading-6 text-slate-500 transition-colors group-hover:text-slate-300 dark:text-slate-400"
						>
							{{ t('home.loginDescription') }}
						</p>
					</div>
				</div>
			</button>
		</section>
	</div>
</template>
