<script setup lang="ts">
definePageMeta({
	public: true,
})

const { t } = useI18n()
const route = useRoute()
const toast = useToast()

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
	<main
		class="grid min-h-screen place-items-center bg-slate-50 p-6 dark:bg-slate-950"
	>
		<section class="w-full max-w-md p-8 text-center">
			<div
				class="mx-auto mb-5 grid size-12 place-items-center rounded-2xl bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-300"
			>
				<UIcon name="i-lucide-shield-check" class="size-6" />
			</div>
			<p class="text-sm font-medium text-slate-500 dark:text-slate-400">
				{{ t('auth.eyebrow') }}
			</p>
			<h1 class="mt-2 text-2xl font-semibold">
				{{ t('auth.welcomeTitle') }}
			</h1>
			<p class="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
				{{ t('auth.welcomeDescription') }}
			</p>
			<UButton
				color="primary"
				class="mt-7"
				to="/api/oidc/hydcraft/login"
				external
			>
				{{ t('auth.signIn') }}
			</UButton>
		</section>
	</main>
</template>
