<script setup lang="ts">
import { en, ja, zh_cn, zh_tw } from '@nuxt/ui/locale'

const { locale } = useI18n()
const nuxtUiLocale = computed(
	() =>
		({ 'zh-CN': zh_cn, 'zh-TW': zh_tw, 'ja-JP': ja, 'en-US': en })[
			locale.value
		] ?? zh_cn,
)
</script>

<template>
	<UApp :locale="nuxtUiLocale" :toaster="{ position: 'top-right' }">
		<NuxtLayout><NuxtPage /></NuxtLayout>
	</UApp>
</template>
