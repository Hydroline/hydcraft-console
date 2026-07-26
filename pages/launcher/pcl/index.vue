<script setup lang="ts">
interface PclHomepageServer {
	id: string
	serverId: string
	code: string
	shortCode: string
	nameZhCn: string
	nameZhTw: string
	nameEnUs: string
	nameJaJp: string
	status: string
	configured: boolean
	requestCount: number
}

interface PclHomepageServerResponse {
	servers: PclHomepageServer[]
}

const { t, locale } = useI18n()
const { data, status } = await useFetch<PclHomepageServerResponse>(
	'/api/admin/launcher/pcl/homepages',
)
const columns = computed(() => [
	{ accessorKey: 'nameZhCn', header: t('pclHomepage.server') },
	{ accessorKey: 'configured', header: t('pclHomepage.configuration') },
	{ accessorKey: 'requestCount', header: t('pclHomepage.requestCount') },
	{ id: 'actions', header: '' },
])

const localizedName = (server: PclHomepageServer) => {
	const names = {
		'zh-CN': server.nameZhCn,
		'zh-TW': server.nameZhTw,
		'en-US': server.nameEnUs,
		'ja-JP': server.nameJaJp,
	}
	return names[locale.value as keyof typeof names] ?? server.nameZhCn
}
</script>

<template>
	<section class="space-y-6">
		<h1 class="text-3xl font-semibold tracking-tight">
			{{ t('pclHomepage.title') }}
		</h1>

		<div
			class="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
		>
			<UTable
				:data="data?.servers ?? []"
				:columns="columns"
				:loading="status === 'pending'"
			>
				<template #empty>{{ t('pclHomepage.empty') }}</template>
				<template #nameZhCn-cell="{ row }">
					<div>
						<p class="font-medium">{{ localizedName(row.original) }}</p>
						<p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
							{{ row.original.serverId }} · {{ row.original.code }}
						</p>
					</div>
				</template>
				<template #configured-cell="{ row }">
					<UBadge
						:color="row.original.configured ? 'success' : 'neutral'"
						variant="subtle"
					>
						{{
							t(
								row.original.configured
									? 'pclHomepage.configured'
									: 'pclHomepage.notConfigured',
							)
						}}
					</UBadge>
				</template>
				<template #requestCount-cell="{ row }">
					<div class="text-right tabular-nums">
						{{ row.original.requestCount.toLocaleString() }}
					</div>
				</template>
				<template #actions-cell="{ row }">
					<div class="flex justify-end">
						<UButton
							color="primary"
							variant="soft"
							:to="`/launcher/pcl/${encodeURIComponent(row.original.id)}`"
						>
							{{ t('pclHomepage.edit') }}
						</UButton>
					</div>
				</template>
			</UTable>
		</div>
	</section>
</template>
