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
interface DirectoryUser {
	id: string
	hydrolineId: string
	username: string
	displayName: string | null
	avatarUrl: string | null
	role: string
}
interface DirectoryUsersResponse {
	items: DirectoryUser[]
}
interface ManifestContributor {
	hydrolineId: string
	username: string
	displayName: string | null
	avatarUrl: string | null
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
const clientEditorOpen = ref(false)
const editingClientRelease = ref<ClientRelease | null>(null)
const advanced = ref(false)
const version = ref('')
const rawManifest = ref('{\n  "schemaVersion": 1\n}')
const clientChangelog = ref('')
const publisherHydrolineId = ref<string | null>(null)
const contributorHydrolineIds = ref<string[]>([])
const publisher = ref<ManifestContributor | null>(null)
const contributors = ref<ManifestContributor[]>([])
const directoryQuery = ref('')
const directoryResults = ref<DirectoryUser[]>([])
const directoryLoading = ref(false)
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
const asContributor = (value: unknown): ManifestContributor | null => {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return null
	const item = value as Record<string, unknown>
	return typeof item.hydrolineId === 'string' &&
		typeof item.username === 'string'
		? {
				hydrolineId: item.hydrolineId,
				username: item.username,
				displayName:
					typeof item.displayName === 'string' ? item.displayName : null,
				avatarUrl: typeof item.avatarUrl === 'string' ? item.avatarUrl : null,
			}
		: null
}
const openClientEditor = (release: ClientRelease) => {
	editingClientRelease.value = release
	clientChangelog.value =
		typeof release.manifest.changelog === 'string'
			? release.manifest.changelog
			: ''
	publisher.value = asContributor(release.manifest.publisher)
	publisherHydrolineId.value = publisher.value?.hydrolineId ?? null
	contributors.value = Array.isArray(release.manifest.contributors)
		? release.manifest.contributors
				.map(asContributor)
				.filter((item): item is ManifestContributor => Boolean(item))
		: []
	contributorHydrolineIds.value = contributors.value.map(
		(item) => item.hydrolineId,
	)
	directoryQuery.value = ''
	directoryResults.value = []
	clientEditorOpen.value = true
}
const searchDirectory = async () => {
	if (!directoryQuery.value.trim()) {
		directoryResults.value = []
		return
	}
	directoryLoading.value = true
	try {
		const response = await $fetch<DirectoryUsersResponse>('/api/admin/users', {
			query: { q: directoryQuery.value, page: 1, pageSize: 20 },
		})
		directoryResults.value = response.items
	} catch {
		directoryResults.value = []
		toast.add({ title: t('errors.requestFailed'), color: 'error' })
	} finally {
		directoryLoading.value = false
	}
}
const toManifestContributor = (user: DirectoryUser): ManifestContributor => ({
	hydrolineId: user.hydrolineId,
	username: user.username,
	displayName: user.displayName,
	avatarUrl: user.avatarUrl,
})
const selectPublisher = (user: DirectoryUser) => {
	publisherHydrolineId.value = user.hydrolineId
	publisher.value = toManifestContributor(user)
}
const clearPublisher = () => {
	publisherHydrolineId.value = null
	publisher.value = null
}
const toggleContributor = (user: DirectoryUser) => {
	const exists = contributorHydrolineIds.value.includes(user.hydrolineId)
	contributorHydrolineIds.value = exists
		? contributorHydrolineIds.value.filter((id) => id !== user.hydrolineId)
		: [...contributorHydrolineIds.value, user.hydrolineId]
	contributors.value = exists
		? contributors.value.filter((item) => item.hydrolineId !== user.hydrolineId)
		: [...contributors.value, toManifestContributor(user)]
}
const removeContributor = (hydrolineId: string) => {
	contributorHydrolineIds.value = contributorHydrolineIds.value.filter(
		(id) => id !== hydrolineId,
	)
	contributors.value = contributors.value.filter(
		(item) => item.hydrolineId !== hydrolineId,
	)
}
const saveClientEditorial = async () => {
	if (!editingClientRelease.value) return
	try {
		await $fetch(
			`/api/admin/client-releases/${editingClientRelease.value.id}`,
			{
				method: 'PATCH',
				body: {
					changelog: clientChangelog.value,
					publisherHydrolineId: publisherHydrolineId.value,
					contributorHydrolineIds: contributorHydrolineIds.value,
				},
			},
		)
		clientEditorOpen.value = false
		toast.add({ title: t('release.saved'), color: 'success' })
		await refreshClientReleases()
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
				<p
					v-if="selectedKind === 'UPDATER'"
					class="mt-2 text-sm text-slate-500 dark:text-slate-400"
				>
					{{ t('release.updaterNotice') }}
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
			class="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
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
							v-if="selectedKind === 'CLIENT'"
							size="xs"
							color="neutral"
							variant="soft"
							@click="openClientEditor(row.original)"
							>{{ t('release.editClient') }}</UButton
						>
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
		<UModal v-model:open="clientEditorOpen" :title="t('release.editClient')">
			<template #body>
				<div class="space-y-5">
					<UFormField :label="t('release.changelog')">
						<UTextarea v-model="clientChangelog" :rows="10" class="w-full" />
					</UFormField>
					<div class="grid gap-4 sm:grid-cols-2">
						<UFormField :label="t('release.publisher')">
							<div
								v-if="publisher"
								class="flex items-center gap-3 rounded-lg border border-slate-200 p-2 dark:border-slate-800"
							>
								<UAvatar
									:src="publisher.avatarUrl || undefined"
									:alt="publisher.username"
								/>
								<div class="min-w-0 flex-1">
									<p class="truncate text-sm font-medium">
										{{ publisher.displayName || publisher.username }}
									</p>
									<p
										class="truncate text-xs text-slate-500 dark:text-slate-400"
									>
										{{ publisher.hydrolineId }}
									</p>
								</div>
								<UTooltip :text="t('release.clearPublisher')">
									<UButton
										icon="i-lucide-x"
										color="neutral"
										variant="ghost"
										@click="clearPublisher"
									/>
								</UTooltip>
							</div>
							<p v-else class="text-sm text-slate-500 dark:text-slate-400">
								{{ t('release.noPublisher') }}
							</p>
						</UFormField>
						<UFormField :label="t('release.contributors')">
							<div class="space-y-2">
								<div
									v-for="person in contributors"
									:key="person.hydrolineId"
									class="flex items-center gap-3 rounded-lg border border-slate-200 p-2 dark:border-slate-800"
								>
									<UAvatar
										:src="person.avatarUrl || undefined"
										:alt="person.username"
									/>
									<div class="min-w-0 flex-1">
										<p class="truncate text-sm font-medium">
											{{ person.displayName || person.username }}
										</p>
										<p
											class="truncate text-xs text-slate-500 dark:text-slate-400"
										>
											{{ person.hydrolineId }}
										</p>
									</div>
									<UTooltip :text="t('release.removeContributor')">
										<UButton
											icon="i-lucide-x"
											color="neutral"
											variant="ghost"
											@click="removeContributor(person.hydrolineId)"
										/>
									</UTooltip>
								</div>
							</div>
						</UFormField>
					</div>
					<div class="space-y-2">
						<form class="flex gap-2" @submit.prevent="searchDirectory">
							<UInput
								v-model="directoryQuery"
								class="flex-1"
								:placeholder="t('release.peopleSearchPlaceholder')"
							/>
							<UButton
								type="submit"
								icon="i-lucide-search"
								:loading="directoryLoading"
								>{{ t('actions.search') }}</UButton
							>
						</form>
						<div
							v-for="user in directoryResults"
							:key="user.id"
							class="flex items-center gap-3 rounded-lg border border-slate-200 p-2 dark:border-slate-800"
						>
							<UAvatar
								:src="user.avatarUrl || undefined"
								:alt="user.username"
							/>
							<div class="min-w-0 flex-1">
								<p class="truncate text-sm font-medium">
									{{ user.displayName || user.username }}
								</p>
								<p class="truncate text-xs text-slate-500 dark:text-slate-400">
									{{ user.hydrolineId }}
								</p>
							</div>
							<UButton
								size="xs"
								color="neutral"
								variant="soft"
								@click="selectPublisher(user)"
							>
								{{ t('release.assignPublisher') }}
							</UButton>
							<UButton
								size="xs"
								:color="
									contributorHydrolineIds.includes(user.hydrolineId)
										? 'primary'
										: 'neutral'
								"
								:variant="
									contributorHydrolineIds.includes(user.hydrolineId)
										? 'soft'
										: 'ghost'
								"
								@click="toggleContributor(user)"
								>{{ t('release.assignContributor') }}</UButton
							>
						</div>
					</div>
					<div class="flex justify-end gap-2">
						<UButton
							color="neutral"
							variant="ghost"
							@click="clientEditorOpen = false"
							>{{ t('actions.cancel') }}</UButton
						>
						<UButton color="primary" @click="saveClientEditorial">{{
							t('actions.save')
						}}</UButton>
					</div>
				</div>
			</template>
		</UModal>
	</section>
</template>
