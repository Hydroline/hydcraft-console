<script setup lang="ts">
interface Release {
	id: string
	kind: 'CLIENT' | 'UPDATER'
	version: string
	revision: number
	status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
	manifest: Record<string, unknown>
}

const route = useRoute()
const { t } = useI18n()
const toast = useToast()
const { data: releases, refresh } = await useFetch<Release[]>(
	'/api/admin/releases',
)
const release = computed(() =>
	(releases.value ?? []).find((entry) => entry.id === route.params.id),
)
if (!release.value) {
	throw createError({ statusCode: 404, statusMessage: 'RELEASE_NOT_FOUND' })
}
const original = JSON.stringify(release.value.manifest, null, 2)
const rawManifest = ref(original)
const normalizedPreview = computed(() => {
	try {
		return JSON.stringify(JSON.parse(rawManifest.value), null, 2)
	} catch {
		return rawManifest.value
	}
})
const hasChanges = computed(() => normalizedPreview.value !== original)
const save = async () => {
	try {
		await $fetch(`/api/admin/releases/${route.params.id}`, {
			method: 'PATCH',
			body: { manifest: JSON.parse(rawManifest.value) },
		})
		await refresh()
		toast.add({ title: t('release.saved'), color: 'success' })
	} catch {
		toast.add({ title: t('errors.invalidManifest'), color: 'error' })
	}
}
const publish = async () => {
	try {
		await $fetch(`/api/admin/releases/${route.params.id}/publish`, {
			method: 'POST',
		})
		await refresh()
		toast.add({ title: t('release.published'), color: 'success' })
	} catch {
		toast.add({ title: t('errors.requestFailed'), color: 'error' })
	}
}
const rollback = async () => {
	try {
		const draft = await $fetch<{ id: string }>(
			`/api/admin/releases/${route.params.id}/rollback`,
			{ method: 'POST' },
		)
		await navigateTo(`/releases/${draft.id}`)
	} catch {
		toast.add({ title: t('errors.requestFailed'), color: 'error' })
	}
}
</script>

<template>
	<section v-if="release" class="space-y-6">
		<div class="flex flex-wrap items-end justify-between gap-4">
			<div>
				<UButton
					to="/releases"
					color="neutral"
					variant="link"
					icon="i-lucide-arrow-left"
				>
					{{ t('release.back') }}
				</UButton>
				<h1 class="mt-2 text-3xl font-semibold tracking-tight">
					{{ release.kind }} {{ release.version }} · #{{ release.revision }}
				</h1>
				<p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
					{{ t('release.snapshotNotice') }}
				</p>
			</div>
			<div class="flex gap-2">
				<UButton
					v-if="release.status === 'DRAFT'"
					color="primary"
					@click="save"
					>{{ t('release.saveDraft') }}</UButton
				>
				<UButton
					v-if="release.status === 'DRAFT'"
					color="primary"
					@click="publish"
					>{{ t('release.publish') }}</UButton
				>
				<UButton
					v-if="release.status !== 'DRAFT'"
					color="warning"
					variant="soft"
					@click="rollback"
					>{{ t('release.rollback') }}</UButton
				>
			</div>
		</div>
		<div class="grid gap-6 xl:grid-cols-2">
			<UFormField :label="t('release.manifestJson')">
				<UTextarea
					v-model="rawManifest"
					:disabled="release.status !== 'DRAFT'"
					:rows="28"
					class="w-full font-mono text-xs"
				/>
			</UFormField>
			<UFormField :label="t('release.diffPreview')">
				<pre
					class="max-h-[38rem] overflow-auto rounded-xl bg-neutral-950 p-4 text-xs text-neutral-100"
					>{{ normalizedPreview }}</pre>
				<p v-if="hasChanges" class="mt-2 text-xs text-warning-600">
					{{ t('release.unsavedChanges') }}
				</p>
			</UFormField>
		</div>
	</section>
</template>
