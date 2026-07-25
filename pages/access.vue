<script setup lang="ts">
interface DirectoryUser {
	id: string
	hydrolineId: string
	username: string
	displayName: string | null
	avatarUrl: string | null
	role: string
}

interface Entitlement {
	key: string
	labels: Record<string, string>
}

interface DirectoryUsersResponse {
	items: DirectoryUser[]
	total: number
	page: number
	pageSize: number
}

const { t } = useI18n()
const toast = useToast()
const keyword = ref('')
const page = ref(1)
const pageSize = ref(20)
const searched = ref(false)
const selected = ref<DirectoryUser | null>(null)
const selectedKeys = ref<string[]>([])
const { data: definitions } = await useFetch<{ entitlements: Entitlement[] }>(
	'/api/admin/distribution',
)
const {
	data: results,
	execute,
	status,
} = await useFetch<DirectoryUsersResponse>('/api/admin/users', {
	query: { q: keyword, page, pageSize },
	immediate: false,
})

const columns = [
	{ accessorKey: 'user', header: t('access.user') },
	{ accessorKey: 'hydrolineId', header: t('access.hydrolineId') },
	{ accessorKey: 'role', header: t('access.role') },
	{ id: 'actions', header: '' },
]
const entitlementColumns = [
	{ accessorKey: 'key', header: t('distribution.key') },
	{ accessorKey: 'label', header: t('distribution.labelZhCn') },
	{ id: 'actions', header: '' },
]
const pageCount = computed(() =>
	Math.max(1, Math.ceil((results.value?.total ?? 0) / pageSize.value)),
)

const search = async () => {
	selected.value = null
	selectedKeys.value = []
	page.value = 1
	searched.value = true
	await execute()
}
const loadPage = async (value: number): Promise<void> => {
	page.value = value
	await execute()
}
const setPageSize = async (value: number): Promise<void> => {
	pageSize.value = value
	page.value = 1
	await execute()
}
const selectUser = (user: DirectoryUser): void => {
	selected.value = user
	selectedKeys.value = []
}
const save = async () => {
	if (!selected.value) return
	try {
		await $fetch('/api/admin/access', {
			method: 'POST',
			body: { subject: selected.value, entitlementKeys: selectedKeys.value },
		})
		toast.add({ title: t('access.saved'), color: 'success' })
	} catch {
		toast.add({ title: t('errors.requestFailed'), color: 'error' })
	}
}
</script>

<template>
	<section class="space-y-6">
		<div>
			<h1 class="text-3xl font-semibold tracking-tight">
				{{ t('access.title') }}
			</h1>
		</div>
		<form class="flex max-w-xl gap-2" @submit.prevent="search">
			<UInput
				v-model="keyword"
				class="flex-1"
				:placeholder="t('access.searchPlaceholder')"
			/>
			<UButton
				type="submit"
				color="primary"
				icon="i-lucide-search"
				:loading="status === 'pending'"
			>
				{{ t('actions.search') }}
			</UButton>
		</form>

		<div
			class="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"
		>
			<UTable
				:data="results?.items ?? []"
				:columns="columns"
				:loading="status === 'pending'"
				class="min-h-72 min-w-full"
			>
				<template #user-cell="{ row }">
					<button
						type="button"
						class="flex min-w-0 items-center gap-3 text-left"
						@click="selectUser(row.original)"
					>
						<UAvatar
							:src="row.original.avatarUrl || undefined"
							:alt="row.original.username"
						/>
						<span class="min-w-0">
							<span class="block truncate font-medium">
								{{ row.original.displayName || row.original.username }}
							</span>
							<span
								class="block truncate text-xs text-slate-500 dark:text-slate-400"
							>
								@{{ row.original.username }}
							</span>
						</span>
					</button>
				</template>
				<template #hydrolineId-cell="{ row }">
					<span class="text-xs">{{ row.original.hydrolineId }}</span>
				</template>
				<template #role-cell="{ row }">
					<UBadge color="neutral" variant="subtle">{{
						row.original.role
					}}</UBadge>
				</template>
				<template #actions-cell="{ row }">
					<UButton
						size="xs"
						color="primary"
						variant="soft"
						@click="selectUser(row.original)"
					>
						{{ t('access.select') }}
					</UButton>
				</template>
				<template #empty>
					{{ searched ? t('access.empty') : t('access.selectUser') }}
				</template>
			</UTable>
			<ConsoleTablePagination
				:page="page"
				:page-size="pageSize"
				:total="results?.total ?? 0"
				:page-count="pageCount"
				@update:page="loadPage"
				@update:page-size="setPageSize"
			/>
		</div>

		<div
			class="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"
		>
			<div class="border-b border-slate-200 p-5 dark:border-slate-800">
				<h2 class="font-medium">
					{{
						selected?.displayName ||
						selected?.username ||
						t('access.selectUser')
					}}
				</h2>
				<p
					v-if="selected"
					class="mt-1 text-xs text-slate-500 dark:text-slate-400"
				>
					{{ selected.hydrolineId }}
				</p>
			</div>
			<UTable
				:data="selected ? (definitions?.entitlements ?? []) : []"
				:columns="entitlementColumns"
				class="min-h-48 min-w-full"
			>
				<template #label-cell="{ row }">
					{{ row.original.labels['zh-CN'] || row.original.key }}
				</template>
				<template #actions-cell="{ row }">
					<UCheckbox
						v-model="selectedKeys"
						:value="row.original.key"
						:label="t('access.grant')"
					/>
				</template>
				<template #empty>{{ t('access.selectUser') }}</template>
			</UTable>
			<div
				v-if="selected"
				class="flex justify-end border-t border-slate-200 p-4 dark:border-slate-800"
			>
				<UButton color="primary" @click="save">{{ t('actions.save') }}</UButton>
			</div>
		</div>
	</section>
</template>
