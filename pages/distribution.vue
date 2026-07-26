<script setup lang="ts">
interface Source {
	id: string
	key: string
	labels: Record<string, string>
	baseUrl: string
	priority: number
	isDefault: boolean
	enabled: boolean
	policy?: {
		sourceDelivery?: 'public' | 'edgeone'
		edgeoneConfigured?: boolean
		authParam?: string
		tokenLifetime?: number
	}
}

interface Category {
	id: string
	key: string
	labels: Record<string, string>
	installTarget: string
	realDirectory: string | null
	entitlements: string[]
	sourceIds: string[]
	enabled: boolean
}

interface Entitlement {
	key: string
	labels: Record<string, string>
	enabled: boolean
}

const { t } = useI18n()
const toast = useToast()
const { data, refresh } = await useFetch<{
	sources: Source[]
	categories: Category[]
	entitlements: Entitlement[]
}>('/api/admin/distribution')

const tab = ref<'sources' | 'categories'>('sources')
const sourcePage = ref(1)
const categoryPage = ref(1)
const entitlementPage = ref(1)
const pageSize = ref(20)
const sourceModalOpen = ref(false)
const categoryModalOpen = ref(false)
const entitlementModalOpen = ref(false)
const source = reactive({
	key: '',
	label: '',
	baseUrl: '',
	priority: 0,
	isDefault: false,
	sourceDelivery: 'public' as 'public' | 'edgeone',
	signingKey: '',
	authParam: 'token',
	tokenLifetime: 3600,
})
const editingSource = ref(false)
const entitlement = reactive({ key: '', label: '' })
const category = reactive({
	key: '',
	label: '',
	installTarget: '',
	realDirectory: '',
	sourceIds: '',
	entitlements: '',
	entitlementMode: 'ANY' as 'ANY' | 'ALL',
})

const sources = computed(() => data.value?.sources ?? [])
const categories = computed(() => data.value?.categories ?? [])
const entitlements = computed(() => data.value?.entitlements ?? [])
const sourcePageCount = computed(() =>
	Math.max(1, Math.ceil(sources.value.length / pageSize.value)),
)
const categoryPageCount = computed(() =>
	Math.max(1, Math.ceil(categories.value.length / pageSize.value)),
)
const entitlementPageCount = computed(() =>
	Math.max(1, Math.ceil(entitlements.value.length / pageSize.value)),
)
const paginatedSources = computed(() =>
	sources.value.slice(
		(sourcePage.value - 1) * pageSize.value,
		sourcePage.value * pageSize.value,
	),
)
const paginatedCategories = computed(() =>
	categories.value.slice(
		(categoryPage.value - 1) * pageSize.value,
		categoryPage.value * pageSize.value,
	),
)
const paginatedEntitlements = computed(() =>
	entitlements.value.slice(
		(entitlementPage.value - 1) * pageSize.value,
		entitlementPage.value * pageSize.value,
	),
)

const sourceColumns = [
	{ accessorKey: 'key', header: t('distribution.key') },
	{ accessorKey: 'label', header: t('distribution.labelZhCn') },
	{ accessorKey: 'baseUrl', header: t('distribution.baseUrl') },
	{ accessorKey: 'priority', header: t('distribution.priority') },
	{ accessorKey: 'status', header: t('release.status') },
	{ id: 'actions', header: '' },
]
const categoryColumns = [
	{ accessorKey: 'key', header: t('distribution.key') },
	{ accessorKey: 'label', header: t('distribution.labelZhCn') },
	{ accessorKey: 'installTarget', header: t('distribution.installTarget') },
	{ accessorKey: 'entitlements', header: t('distribution.entitlementKeys') },
	{ accessorKey: 'status', header: t('release.status') },
]
const entitlementColumns = [
	{ accessorKey: 'key', header: t('distribution.key') },
	{ accessorKey: 'label', header: t('distribution.labelZhCn') },
	{ accessorKey: 'status', header: t('release.status') },
]

const resetSource = (): void => {
	Object.assign(source, {
		key: '',
		label: '',
		baseUrl: '',
		priority: 0,
		isDefault: false,
		sourceDelivery: 'public',
		signingKey: '',
		authParam: 'token',
		tokenLifetime: 3600,
	})
	editingSource.value = false
}

const openSourceEditor = (existing?: Source): void => {
	if (!existing) {
		resetSource()
		sourceModalOpen.value = true
		return
	}
	Object.assign(source, {
		key: existing.key,
		label: existing.labels['zh-CN'] ?? existing.key,
		baseUrl: existing.baseUrl,
		priority: existing.priority,
		isDefault: existing.isDefault,
		sourceDelivery: existing.policy?.sourceDelivery ?? 'public',
		signingKey: '',
		authParam: existing.policy?.authParam ?? 'token',
		tokenLifetime: existing.policy?.tokenLifetime ?? 3600,
	})
	editingSource.value = true
	sourceModalOpen.value = true
}
const resetCategory = (): void => {
	Object.assign(category, {
		key: '',
		label: '',
		installTarget: '',
		realDirectory: '',
		sourceIds: '',
		entitlements: '',
		entitlementMode: 'ANY',
	})
}
const resetEntitlement = (): void => {
	Object.assign(entitlement, { key: '', label: '' })
}

const saveSource = async () => {
	try {
		await $fetch('/api/admin/distribution', {
			method: 'POST',
			body: {
				type: 'source',
				key: source.key,
				labels: { 'zh-CN': source.label },
				baseUrl: source.baseUrl,
				priority: Number(source.priority),
				isDefault: source.isDefault,
				enabled: true,
				policy:
					source.sourceDelivery === 'edgeone'
						? {
								sourceDelivery: 'edgeone',
								edgeone: {
									signingKey: source.signingKey || undefined,
									authParam: source.authParam,
									tokenLifetime: Number(source.tokenLifetime),
								},
							}
						: { sourceDelivery: 'public' },
			},
		})
		resetSource()
		sourceModalOpen.value = false
		await refresh()
		toast.add({ title: t('distribution.saved'), color: 'success' })
	} catch {
		toast.add({ title: t('errors.requestFailed'), color: 'error' })
	}
}

const saveEntitlement = async () => {
	try {
		await $fetch('/api/admin/distribution', {
			method: 'POST',
			body: {
				type: 'entitlement',
				key: entitlement.key,
				labels: { 'zh-CN': entitlement.label },
				enabled: true,
			},
		})
		resetEntitlement()
		entitlementModalOpen.value = false
		await refresh()
		toast.add({ title: t('distribution.saved'), color: 'success' })
	} catch {
		toast.add({ title: t('errors.requestFailed'), color: 'error' })
	}
}

const saveCategory = async () => {
	try {
		await $fetch('/api/admin/distribution', {
			method: 'POST',
			body: {
				type: 'category',
				key: category.key,
				labels: { 'zh-CN': category.label },
				installTarget: category.installTarget,
				realDirectory: category.realDirectory || undefined,
				entitlementMode: category.entitlementMode,
				entitlements: category.entitlements
					.split(',')
					.map((value) => value.trim())
					.filter(Boolean),
				sourceIds: category.sourceIds
					.split(',')
					.map((value) => value.trim())
					.filter(Boolean),
				enabled: true,
			},
		})
		resetCategory()
		categoryModalOpen.value = false
		await refresh()
		toast.add({ title: t('distribution.saved'), color: 'success' })
	} catch {
		toast.add({ title: t('errors.requestFailed'), color: 'error' })
	}
}

const probe = async (id: string) => {
	try {
		const result = await $fetch<{ ok: boolean; status: number }>(
			`/api/admin/distribution/sources/${id}/probe`,
			{ method: 'POST' },
		)
		toast.add({
			title: result.ok
				? t('distribution.probeSuccess')
				: t('distribution.probeFailed'),
			description: String(result.status),
			color: result.ok ? 'success' : 'error',
		})
	} catch {
		toast.add({ title: t('distribution.probeFailed'), color: 'error' })
	}
}

const setPageSize = (value: number): void => {
	pageSize.value = value
	sourcePage.value = 1
	categoryPage.value = 1
	entitlementPage.value = 1
}
</script>

<template>
	<section class="space-y-6">
		<div class="flex flex-wrap items-end justify-between gap-4">
			<h1 class="text-3xl font-semibold tracking-tight">
				{{ t('distribution.title') }}
			</h1>
			<div class="flex flex-wrap gap-2">
				<UButton
					v-if="tab === 'sources'"
					color="primary"
					icon="i-lucide-plus"
					@click="openSourceEditor()"
				>
					{{ t('distribution.newSource') }}
				</UButton>
				<template v-else>
					<UButton
						color="primary"
						icon="i-lucide-plus"
						@click="categoryModalOpen = true"
					>
						{{ t('distribution.newCategory') }}
					</UButton>
					<UButton
						color="primary"
						variant="soft"
						icon="i-lucide-plus"
						@click="entitlementModalOpen = true"
					>
						{{ t('distribution.newEntitlement') }}
					</UButton>
				</template>
			</div>
		</div>

		<div class="flex gap-2">
			<UButton
				color="primary"
				:variant="tab === 'sources' ? 'solid' : 'soft'"
				@click="tab = 'sources'"
			>
				{{ t('distribution.sources') }}
			</UButton>
			<UButton
				color="primary"
				:variant="tab === 'categories' ? 'solid' : 'soft'"
				@click="tab = 'categories'"
			>
				{{ t('distribution.categories') }}
			</UButton>
		</div>

		<div
			v-if="tab === 'sources'"
			class="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
		>
			<UTable
				:data="paginatedSources"
				:columns="sourceColumns"
				class="min-h-72 min-w-full"
			>
				<template #label-cell="{ row }">
					{{ row.original.labels['zh-CN'] || row.original.key }}
				</template>
				<template #baseUrl-cell="{ row }">
					<span class="text-xs">{{ row.original.baseUrl }}</span>
				</template>
				<template #status-cell="{ row }">
					<UBadge
						:color="row.original.enabled ? 'success' : 'neutral'"
						variant="subtle"
					>
						{{
							row.original.enabled
								? t('settings.configured')
								: t('settings.missing')
						}}
					</UBadge>
				</template>
				<template #priority-cell="{ row }">
					<div class="flex items-center gap-2">
						<span>{{ row.original.priority }}</span>
						<UBadge
							v-if="row.original.isDefault"
							color="primary"
							variant="soft"
							size="xs"
						>
							{{ t('distribution.defaultSource') }}
						</UBadge>
					</div>
				</template>
				<template #actions-cell="{ row }">
					<UButton
						size="xs"
						color="neutral"
						variant="ghost"
						@click="openSourceEditor(row.original)"
					>
						{{ t('actions.configure') }}
					</UButton>
					<UButton
						size="xs"
						color="neutral"
						variant="ghost"
						@click="probe(row.original.id)"
					>
						{{ t('distribution.probe') }}
					</UButton>
				</template>
				<template #empty>{{ t('distribution.empty') }}</template>
			</UTable>
			<ConsoleTablePagination
				:page="sourcePage"
				:page-size="pageSize"
				:total="sources.length"
				:page-count="sourcePageCount"
				@update:page="sourcePage = $event"
				@update:page-size="setPageSize"
			/>
		</div>

		<div v-else class="space-y-6">
			<div
				class="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
			>
				<UTable
					:data="paginatedCategories"
					:columns="categoryColumns"
					class="min-h-72 min-w-full"
				>
					<template #label-cell="{ row }">
						{{ row.original.labels['zh-CN'] || row.original.key }}
					</template>
					<template #installTarget-cell="{ row }">
						<span class="text-xs">{{ row.original.installTarget }}</span>
					</template>
					<template #entitlements-cell="{ row }">
						{{
							row.original.entitlements.join(', ') ||
							t('distribution.noEntitlements')
						}}
					</template>
					<template #status-cell="{ row }">
						<UBadge
							:color="row.original.enabled ? 'success' : 'neutral'"
							variant="subtle"
						>
							{{
								row.original.enabled
									? t('settings.configured')
									: t('settings.missing')
							}}
						</UBadge>
					</template>
					<template #empty>{{ t('distribution.empty') }}</template>
				</UTable>
				<ConsoleTablePagination
					:page="categoryPage"
					:page-size="pageSize"
					:total="categories.length"
					:page-count="categoryPageCount"
					@update:page="categoryPage = $event"
					@update:page-size="setPageSize"
				/>
			</div>

			<div
				class="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
			>
				<div class="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
					<h2 class="font-medium">{{ t('distribution.entitlements') }}</h2>
				</div>
				<UTable
					:data="paginatedEntitlements"
					:columns="entitlementColumns"
					class="min-h-48 min-w-full"
				>
					<template #label-cell="{ row }">
						{{ row.original.labels['zh-CN'] || row.original.key }}
					</template>
					<template #status-cell="{ row }">
						<UBadge
							:color="row.original.enabled ? 'success' : 'neutral'"
							variant="subtle"
						>
							{{
								row.original.enabled
									? t('settings.configured')
									: t('settings.missing')
							}}
						</UBadge>
					</template>
					<template #empty>{{ t('distribution.empty') }}</template>
				</UTable>
				<ConsoleTablePagination
					:page="entitlementPage"
					:page-size="pageSize"
					:total="entitlements.length"
					:page-count="entitlementPageCount"
					@update:page="entitlementPage = $event"
					@update:page-size="setPageSize"
				/>
			</div>
		</div>

		<UModal
			v-model:open="sourceModalOpen"
			:title="
				editingSource ? t('actions.configure') : t('distribution.newSource')
			"
		>
			<template #body>
				<form class="space-y-4" @submit.prevent="saveSource">
					<UFormField :label="t('distribution.key')"
						><UInput
							v-model="source.key"
							:disabled="editingSource"
							class="w-full"
					/></UFormField>
					<UFormField :label="t('distribution.labelZhCn')"
						><UInput v-model="source.label" class="w-full"
					/></UFormField>
					<UFormField :label="t('distribution.baseUrl')"
						><UInput v-model="source.baseUrl" class="w-full"
					/></UFormField>
					<UFormField :label="t('distribution.delivery')">
						<USelect
							v-model="source.sourceDelivery"
							:items="[
								{ label: t('distribution.publicDelivery'), value: 'public' },
								{ label: t('distribution.edgeoneDelivery'), value: 'edgeone' },
							]"
							class="w-full"
						/>
					</UFormField>
					<template v-if="source.sourceDelivery === 'edgeone'">
						<UFormField :label="t('distribution.edgeoneSigningKey')">
							<UInput
								v-model="source.signingKey"
								type="password"
								autocomplete="new-password"
								:placeholder="
									editingSource
										? t('distribution.edgeoneKeyUnchanged')
										: t('distribution.edgeoneKeyRequired')
								"
								class="w-full"
							/>
						</UFormField>
						<UFormField :label="t('distribution.edgeoneAuthParam')">
							<UInput v-model="source.authParam" class="w-full" />
						</UFormField>
						<UFormField :label="t('distribution.edgeoneTokenLifetime')">
							<UInput
								v-model.number="source.tokenLifetime"
								type="number"
								min="60"
								max="86400"
								class="w-full"
							/>
						</UFormField>
					</template>
					<UFormField :label="t('distribution.priority')"
						><UInput
							v-model.number="source.priority"
							type="number"
							class="w-full"
					/></UFormField>
					<UCheckbox
						v-model="source.isDefault"
						:label="t('distribution.defaultSource')"
					/>
					<div class="flex justify-end gap-2">
						<UButton
							color="neutral"
							variant="ghost"
							type="button"
							@click="sourceModalOpen = false"
							>{{ t('actions.cancel') }}</UButton
						>
						<UButton color="primary" type="submit">{{
							t('actions.save')
						}}</UButton>
					</div>
				</form>
			</template>
		</UModal>

		<UModal
			v-model:open="categoryModalOpen"
			:title="t('distribution.newCategory')"
		>
			<template #body>
				<form class="space-y-4" @submit.prevent="saveCategory">
					<UFormField :label="t('distribution.key')"
						><UInput v-model="category.key" class="w-full"
					/></UFormField>
					<UFormField :label="t('distribution.labelZhCn')"
						><UInput v-model="category.label" class="w-full"
					/></UFormField>
					<UFormField :label="t('distribution.installTarget')"
						><UInput v-model="category.installTarget" class="w-full"
					/></UFormField>
					<UFormField :label="t('distribution.realDirectory')"
						><UInput v-model="category.realDirectory" class="w-full"
					/></UFormField>
					<UFormField :label="t('distribution.sourceIds')"
						><UInput v-model="category.sourceIds" class="w-full"
					/></UFormField>
					<UFormField :label="t('distribution.entitlementKeys')"
						><UInput v-model="category.entitlements" class="w-full"
					/></UFormField>
					<UFormField :label="t('distribution.entitlementMode')">
						<USelect
							v-model="category.entitlementMode"
							class="w-full"
							:items="[
								{ label: 'ANY', value: 'ANY' },
								{ label: 'ALL', value: 'ALL' },
							]"
						/>
					</UFormField>
					<div class="flex justify-end gap-2">
						<UButton
							color="neutral"
							variant="ghost"
							type="button"
							@click="categoryModalOpen = false"
							>{{ t('actions.cancel') }}</UButton
						>
						<UButton color="primary" type="submit">{{
							t('actions.save')
						}}</UButton>
					</div>
				</form>
			</template>
		</UModal>

		<UModal
			v-model:open="entitlementModalOpen"
			:title="t('distribution.newEntitlement')"
		>
			<template #body>
				<form class="space-y-4" @submit.prevent="saveEntitlement">
					<UFormField :label="t('distribution.key')"
						><UInput v-model="entitlement.key" class="w-full"
					/></UFormField>
					<UFormField :label="t('distribution.labelZhCn')"
						><UInput v-model="entitlement.label" class="w-full"
					/></UFormField>
					<div class="flex justify-end gap-2">
						<UButton
							color="neutral"
							variant="ghost"
							type="button"
							@click="entitlementModalOpen = false"
							>{{ t('actions.cancel') }}</UButton
						>
						<UButton color="primary" type="submit">{{
							t('actions.save')
						}}</UButton>
					</div>
				</form>
			</template>
		</UModal>
	</section>
</template>
