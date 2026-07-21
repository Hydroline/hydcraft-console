<script setup lang="ts">
definePageMeta({ layout: false })
const { t } = useI18n()
</script>
<template>
	<main
		class="grid min-h-screen place-items-center bg-slate-50 p-6 dark:bg-slate-950"
	>
		<section class="w-full max-w-md p-8 text-center">
			<UIcon
				name="i-lucide-circle-check-big"
				class="mx-auto mb-4 size-10 text-success-500"
			/>
			<h1 class="text-xl font-semibold">{{ t('auth.signedOut') }}</h1>
			<p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
				{{ t('auth.signedOutDescription') }}
			</p>
			<UButton
				color="primary"
				class="mt-6"
				to="/api/oidc/hydcraft/login"
				external
				>{{ t('auth.signIn') }}</UButton
			>
		</section>
	</main>
</template>
