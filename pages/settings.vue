<script setup lang="ts">
interface Token {
	id: string
	name: string
	scopes: string[]
	revokedAt: string | null
	createdAt: string
}

interface Configuration {
	database: boolean
	oidc: boolean
	sourceSecretEncryptionConfigured: boolean
}

const { t } = useI18n()
const toast = useToast()
const { data, refresh, status } = await useFetch<{
	tokens: Token[]
	configuration: Configuration
}>('/api/admin/settings')
const open = ref(false)
const name = ref('')
const createdToken = ref('')
const page = ref(1)
const pageSize = ref(20)
const configurationRows = computed(() =>
	Object.entries(data.value?.configuration ?? {}).map(([key, value]) => ({
		key,
		value,
	})),
)
const pageCount = computed(() =>
	Math.max(1, Math.ceil((data.value?.tokens.length ?? 0) / pageSize.value)),
)
const paginatedTokens = computed(() => {
	const start = (page.value - 1) * pageSize.value
	return (data.value?.tokens ?? []).slice(start, start + pageSize.value)
})
const configurationColumns = [
	{ accessorKey: 'key', header: t('settings.configuration') },
	{ accessorKey: 'value', header: t('settings.value') },
]
const tokenColumns = [
	{ accessorKey: 'name', header: t('settings.tokenName') },
	{ accessorKey: 'scopes', header: t('settings.scopes') },
	{ accessorKey: 'status', header: t('release.status') },
	{ accessorKey: 'createdAt', header: t('settings.createdAt') },
	{ id: 'actions', header: '' },
]
const setPageSize = (value: number): void => {
	pageSize.value = value
	page.value = 1
}
const create = async () => {
	try {
		const result = await $fetch<{ token: string }>(
			'/api/admin/settings/tokens',
			{
				method: 'POST',
				body: { name: name.value, scopes: ['CLIENT', 'UPDATER'] },
			},
		)
		createdToken.value = result.token
		await refresh()
	} catch {
		toast.add({ title: t('errors.requestFailed'), color: 'error' })
	}
}
const revoke = async (id: string) => {
	try {
		await $fetch(`/api/admin/settings/tokens/${id}/revoke`, { method: 'POST' })
		await refresh()
	} catch {
		toast.add({ title: t('errors.requestFailed'), color: 'error' })
	}
}
</script>

<template>
	<section class="space-y-6">
		<div class="flex flex-wrap items-end justify-between gap-4">
			<div>
				<h1 class="text-3xl font-semibold">{{ t('settings.title') }}</h1>
			</div>
			<UButton color="primary" icon="i-lucide-key-round" @click="open = true">
				{{ t('settings.newToken') }}
			</UButton>
		</div>

		<div
			class="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
		>
			<UTable
				:data="configurationRows"
				:columns="configurationColumns"
				:loading="status === 'pending'"
				class="min-h-48 min-w-full"
			>
				<template #value-cell="{ row }">
					<UBadge
						:color="row.original.value ? 'success' : 'error'"
						variant="subtle"
					>
						{{
							row.original.value
								? t('settings.configured')
								: t('settings.missing')
						}}
					</UBadge>
				</template>
				<template #empty>{{ t('settings.emptyConfiguration') }}</template>
			</UTable>
		</div>

		<div
			class="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
		>
			<UTable
				:data="paginatedTokens"
				:columns="tokenColumns"
				:loading="status === 'pending'"
				class="min-h-72 min-w-full"
			>
				<template #scopes-cell="{ row }">
					<div class="flex flex-wrap gap-1">
						<UBadge
							v-for="scope in row.original.scopes"
							:key="scope"
							color="neutral"
							variant="soft"
						>
							{{ scope }}
						</UBadge>
					</div>
				</template>
				<template #status-cell="{ row }">
					<UBadge
						:color="row.original.revokedAt ? 'error' : 'success'"
						variant="subtle"
					>
						{{
							row.original.revokedAt
								? t('settings.revoked')
								: t('settings.active')
						}}
					</UBadge>
				</template>
				<template #createdAt-cell="{ row }">
					{{ new Date(row.original.createdAt).toLocaleString() }}
				</template>
				<template #actions-cell="{ row }">
					<UButton
						v-if="!row.original.revokedAt"
						size="xs"
						color="error"
						variant="soft"
						@click="revoke(row.original.id)"
					>
						{{ t('settings.revoke') }}
					</UButton>
				</template>
				<template #empty>{{ t('settings.emptyTokens') }}</template>
			</UTable>
			<ConsoleTablePagination
				:page="page"
				:page-size="pageSize"
				:total="data?.tokens.length ?? 0"
				:page-count="pageCount"
				@update:page="page = $event"
				@update:page-size="setPageSize"
			/>
		</div>

		<UModal v-model:open="open" :title="t('settings.newToken')">
			<template #body>
				<div class="space-y-4">
					<UFormField :label="t('settings.tokenName')">
						<UInput v-model="name" class="w-full" />
					</UFormField>
					<div
						v-if="createdToken"
						class="rounded-lg bg-warning-50 p-3 text-sm text-warning-900 dark:bg-warning-950 dark:text-warning-100"
					>
						<p>{{ t('settings.copyOnce') }}</p>
						<code class="mt-2 block break-all">{{ createdToken }}</code>
					</div>
					<div class="flex justify-end gap-2">
						<UButton color="neutral" variant="ghost" @click="open = false">
							{{ t('actions.cancel') }}
						</UButton>
						<UButton v-if="!createdToken" color="primary" @click="create">
							{{ t('actions.create') }}
						</UButton>
					</div>
				</div>
			</template>
		</UModal>
	</section>
</template>
