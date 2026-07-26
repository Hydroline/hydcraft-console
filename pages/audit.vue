<script setup lang="ts">
interface Audit {
	id: string
	action: string
	resource: string
	resourceId: string
	createdAt: string
	actor: { username: string } | null
}

const { t, locale } = useI18n()
const { data, status } = await useFetch<Audit[]>('/api/admin/audit')
const page = ref(1)
const pageSize = ref(20)
const columns = [
	{ accessorKey: 'action', header: t('audit.action') },
	{ accessorKey: 'resource', header: t('audit.resource') },
	{ accessorKey: 'resourceId', header: t('audit.resourceId') },
	{ accessorKey: 'actor', header: t('audit.actor') },
	{ accessorKey: 'createdAt', header: t('audit.createdAt') },
]
const pageCount = computed(() =>
	Math.max(1, Math.ceil((data.value?.length ?? 0) / pageSize.value)),
)
const paginatedItems = computed(() => {
	const start = (page.value - 1) * pageSize.value
	return (data.value ?? []).slice(start, start + pageSize.value)
})
const setPageSize = (value: number): void => {
	pageSize.value = value
	page.value = 1
}
const formatDate = (value: string): string =>
	new Intl.DateTimeFormat(locale.value, {
		dateStyle: 'short',
		timeStyle: 'short',
	}).format(new Date(value))
</script>

<template>
	<section class="space-y-6">
		<div>
			<h1 class="text-3xl font-semibold tracking-tight">
				{{ t('audit.title') }}
			</h1>
		</div>
		<div
			class="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
		>
			<UTable
				:data="paginatedItems"
				:columns="columns"
				:loading="status === 'pending'"
				class="min-h-72 min-w-full"
			>
				<template #action-cell="{ row }">
					<UBadge color="neutral" variant="subtle">
						{{ t(`audit.actions.${row.original.action}`) }}
					</UBadge>
				</template>
				<template #resource-cell="{ row }">
					<span class="text-xs">{{ row.original.resource }}</span>
				</template>
				<template #resourceId-cell="{ row }">
					<span class="text-xs">{{ row.original.resourceId }}</span>
				</template>
				<template #actor-cell="{ row }">
					{{ row.original.actor?.username || t('audit.system') }}
				</template>
				<template #createdAt-cell="{ row }">
					{{ formatDate(row.original.createdAt) }}
				</template>
				<template #empty>{{ t('audit.empty') }}</template>
			</UTable>
			<ConsoleTablePagination
				:page="page"
				:page-size="pageSize"
				:total="data?.length ?? 0"
				:page-count="pageCount"
				@update:page="page = $event"
				@update:page-size="setPageSize"
			/>
		</div>
	</section>
</template>
