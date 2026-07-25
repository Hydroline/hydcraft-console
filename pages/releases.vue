<script setup lang="ts">
interface UpdaterRelease {
	id: string
	kind: 'UPDATER'
	version: string
	revision: number
	status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
	manifest: Record<string, unknown>
}
interface Migration {
	id: string
	packageKey: string
	status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
	fromRelease: { version: string }
	toRelease: { version: string }
}
interface ClientRelease {
	id: string
	version: string
	status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
	manifest: Record<string, unknown>
}

const { t } = useI18n()
const toast = useToast()
const {
	data: releases,
	status,
	refresh: refreshReleases,
} = await useFetch<UpdaterRelease[]>('/api/admin/releases')
const { data: migrations, refresh: refreshMigrations } = await useFetch<
	Migration[]
>('/api/admin/migrations')
const { data: clientReleases, refresh: refreshClientReleases } = await useFetch<
	ClientRelease[]
>('/api/admin/client-releases')
const selectedKind = ref<'MIGRATION' | 'CLIENT' | 'UPDATER'>('MIGRATION')
const open = ref(false)
const advanced = ref(false)
const version = ref('')
const rawManifest = ref('{\n  "schemaVersion": 1\n}')
const updaterReleases = computed(() =>
	(releases.value ?? []).filter((release) => release.kind === 'UPDATER'),
)
const page = ref(1)
const pageSize = ref(20)
const rows = computed(() =>
	selectedKind.value === 'MIGRATION'
		? (migrations.value ?? [])
		: selectedKind.value === 'CLIENT'
			? (clientReleases.value ?? [])
			: updaterReleases.value,
)
const pageCount = computed(() =>
	Math.max(1, Math.ceil(rows.value.length / pageSize.value)),
)
const paginated = computed(() =>
	rows.value.slice(
		(page.value - 1) * pageSize.value,
		page.value * pageSize.value,
	),
)
const columns = computed(() =>
	selectedKind.value === 'MIGRATION'
		? [
				{ accessorKey: 'fromRelease', header: t('release.fromVersion') },
				{ accessorKey: 'toRelease', header: t('release.toVersion') },
				{ accessorKey: 'packageKey', header: t('release.package') },
				{ accessorKey: 'status', header: t('release.status') },
				{ id: 'actions', header: '' },
			]
		: selectedKind.value === 'CLIENT'
			? [
					{ accessorKey: 'version', header: t('release.version') },
					{ accessorKey: 'status', header: t('release.status') },
					{ id: 'actions', header: '' },
				]
			: [
					{ accessorKey: 'version', header: t('release.version') },
					{ accessorKey: 'revision', header: t('release.revision') },
					{ accessorKey: 'status', header: t('release.status') },
					{ id: 'actions', header: '' },
				],
)
watch(selectedKind, () => {
	page.value = 1
})
const create = async () => {
	try {
		const manifest = advanced.value
			? JSON.parse(rawManifest.value)
			: {
					schemaVersion: 1,
					version: version.value,
					platform: 'windows-x86_64',
					urls: [],
					sha256: '',
				}
		await $fetch('/api/admin/releases', {
			method: 'POST',
			body: { kind: 'UPDATER', version: version.value, manifest },
		})
		toast.add({ title: t('release.draftCreated'), color: 'success' })
		open.value = false
		await refreshReleases()
	} catch {
		toast.add({ title: t('errors.invalidManifest'), color: 'error' })
	}
}
const publish = async (id: string) => {
	try {
		const endpoint =
			selectedKind.value === 'MIGRATION'
				? `/api/admin/migrations/${id}/publish`
				: selectedKind.value === 'CLIENT'
					? `/api/admin/client-releases/${id}/publish`
					: `/api/admin/releases/${id}/publish`
		await $fetch(endpoint, { method: 'POST' })
		toast.add({ title: t('release.published'), color: 'success' })
		await Promise.all([
			refreshReleases(),
			refreshMigrations(),
			refreshClientReleases(),
		])
	} catch {
		toast.add({ title: t('errors.requestFailed'), color: 'error' })
	}
}
</script>

<template>
	<section class="space-y-6">
		<div class="flex flex-wrap items-end justify-between gap-4">
			<div>
				<h1 class="text-3xl font-semibold tracking-tight">
					{{ t('release.title') }}
				</h1>
				<p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
					{{
						selectedKind === 'MIGRATION'
							? t('release.migrationNotice')
							: t('release.updaterNotice')
					}}
				</p>
			</div>
			<UButton
				v-if="selectedKind === 'UPDATER'"
				color="primary"
				icon="i-lucide-plus"
				@click="open = true"
				>{{ t('release.newDraft') }}</UButton
			>
		</div>
		<div class="flex gap-2">
			<UButton
				color="primary"
				:variant="selectedKind === 'MIGRATION' ? 'solid' : 'soft'"
				@click="selectedKind = 'MIGRATION'"
				>{{ t('release.migrations') }}</UButton
			><UButton
				color="primary"
				:variant="selectedKind === 'CLIENT' ? 'solid' : 'soft'"
				@click="selectedKind = 'CLIENT'"
				>{{ t('release.client') }}</UButton
			><UButton
				color="primary"
				:variant="selectedKind === 'UPDATER' ? 'solid' : 'soft'"
				@click="selectedKind = 'UPDATER'"
				>{{ t('release.updater') }}</UButton
			>
		</div>
		<div
			class="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"
		>
			<UTable
				:data="paginated"
				:columns="columns"
				:loading="status === 'pending'"
				class="min-h-72 min-w-full"
				><template #fromRelease-cell="{ row }"
					><span class="">{{
						row.original.fromRelease.version
					}}</span></template
				><template #toRelease-cell="{ row }"
					><span class="">{{ row.original.toRelease.version }}</span></template
				><template #packageKey-cell="{ row }"
					><span class="text-xs">{{ row.original.packageKey }}</span></template
				><template #version-cell="{ row }"
					><span class="">{{ row.original.version }}</span></template
				><template #revision-cell="{ row }"
					>#{{ row.original.revision }}</template
				><template #status-cell="{ row }"
					><UBadge
						:color="
							row.original.status === 'PUBLISHED'
								? 'success'
								: row.original.status === 'DRAFT'
									? 'warning'
									: 'neutral'
						"
						variant="subtle"
						>{{ t(`status.${row.original.status}`) }}</UBadge
					></template
				><template #actions-cell="{ row }"
					><div class="flex justify-end gap-2">
						<UButton
							v-if="selectedKind === 'UPDATER'"
							size="xs"
							color="neutral"
							variant="ghost"
							:to="`/releases/${row.original.id}`"
							>{{ t('release.details') }}</UButton
						><UButton
							v-if="row.original.status === 'DRAFT'"
							size="xs"
							color="primary"
							@click="publish(row.original.id)"
							>{{ t('release.publish') }}</UButton
						>
					</div></template
				><template #empty>{{ t('release.empty') }}</template></UTable
			><ConsoleTablePagination
				:page="page"
				:page-size="pageSize"
				:total="rows.length"
				:page-count="pageCount"
				@update:page="page = $event"
				@update:page-size="pageSize = $event"
			/>
		</div>
		<UModal v-model:open="open" :title="t('release.newDraft')"
			><template #body
				><div class="space-y-4">
					<UFormField :label="t('release.version')"
						><UInput v-model="version" class="w-full" /></UFormField
					><UCheckbox
						v-model="advanced"
						:label="t('release.advancedJson')"
					/><UFormField v-if="advanced" :label="t('release.manifestJson')"
						><UTextarea v-model="rawManifest" :rows="12" class="w-full"
					/></UFormField>
					<p class="text-sm text-slate-500 dark:text-slate-400">
						{{ t('release.updaterDraftHint') }}
					</p>
					<div class="flex justify-end gap-2">
						<UButton color="neutral" variant="ghost" @click="open = false">{{
							t('actions.cancel')
						}}</UButton
						><UButton color="primary" @click="create">{{
							t('release.saveDraft')
						}}</UButton>
					</div>
				</div></template
			></UModal
		>
	</section>
</template>
