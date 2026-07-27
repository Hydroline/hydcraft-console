<script setup lang="ts">
interface ConsoleError {
	statusCode?: number
	status?: number
	statusMessage?: string
	message?: string
}

const props = defineProps<{
	error: ConsoleError
}>()

const { t } = useI18n()
const statusCode = computed(
	() => props.error.statusCode ?? props.error.status ?? 500,
)
const reason = computed(
	() =>
		props.error.statusMessage || props.error.message || t('errors.unexpected'),
)

useHead(() => ({
	title: `${statusCode.value} - HydCraft Console`,
	meta: [{ name: 'robots', content: 'noindex,nofollow' }],
}))
</script>

<template>
	<UApp :toaster="{ position: 'top-right', ui: { viewport: 'z-[60000]' } }">
		<LayoutsConsoleShell>
			<section
				class="flex min-h-[calc(100vh-12rem)] items-center justify-center"
			>
				<div class="text-center">
					<p
						class="text-[10rem] font-semibold leading-none text-slate-900 dark:text-slate-50"
					>
						{{ statusCode }}
					</p>
					<p class="mt-2 text-base text-slate-500 dark:text-slate-400">
						{{ reason }}
					</p>
				</div>
			</section>
		</LayoutsConsoleShell>
	</UApp>
</template>
