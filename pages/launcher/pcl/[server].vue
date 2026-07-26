<script setup lang="ts">
import { VueMonacoEditor, type MonacoEditor } from '@guolao/vue-monaco-editor'
import type { editor as MonacoEditorApi } from 'monaco-editor'
import formatXml from 'xml-formatter'

interface PclHomepageServer {
	id: string
	serverId: string
	code: string
	shortCode: string
	nameZhCn: string
}

interface PclHomepageEditorResponse {
	server: PclHomepageServer
	xaml: string
}

const route = useRoute()
const { t } = useI18n()
const toast = useToast()
const variableHelpOpen = ref(false)
const isSaving = ref(false)
const server = computed(() => String(route.params.server))
const { data, status, refresh } = await useFetch<PclHomepageEditorResponse>(
	() => `/api/admin/launcher/pcl/homepages/${encodeURIComponent(server.value)}`,
)
const xaml = ref('')
const loadedXaml = ref('')

const configureEditorTheme = (monaco: MonacoEditor) => {
	monaco.editor.defineTheme('hydcraft-pcl', {
		base: 'vs-dark',
		inherit: true,
		rules: [],
		colors: {
			'editor.background': '#00000000',
			'editorGutter.background': '#00000000',
			'editor.lineHighlightBackground': '#ffffff08',
			'editorStickyScroll.background': '#0f172a',
		},
	})
}

const formatXamlFragment = (xaml: string) => {
	const root = 'pcl-homepage-fragment'
	const formatted = formatXml(`<${root}>\n${xaml.trim()}\n</${root}>`, {
		collapseContent: true,
		indentation: '\t',
		lineSeparator: '\n',
		throwOnFailure: true,
	})
	return formatted
		.split('\n')
		.slice(1, -1)
		.map((line) => (line.startsWith('\t') ? line.slice(1) : line))
		.join('\n')
}

const formatXaml = (editor: MonacoEditorApi.IStandaloneCodeEditor) => {
	const model = editor.getModel()
	if (!model) return

	try {
		const formatted = formatXamlFragment(model.getValue())
		if (formatted === model.getValue()) {
			toast.add({ title: t('pclHomepage.alreadyFormatted'), color: 'neutral' })
			return
		}

		editor.pushUndoStop()
		editor.executeEdits('pcl-homepage.format', [
			{ range: model.getFullModelRange(), text: formatted },
		])
		editor.pushUndoStop()
		toast.add({ title: t('pclHomepage.formatted'), color: 'success' })
	} catch {
		toast.add({ title: t('pclHomepage.formatFailed'), color: 'error' })
	}
}

watch(
	() => data.value?.xaml,
	(value) => {
		if (value === undefined) return
		xaml.value = value
		loadedXaml.value = value
	},
	{ immediate: true },
)

const save = async () => {
	if (isSaving.value) return
	isSaving.value = true
	try {
		await $fetch(
			`/api/admin/launcher/pcl/homepages/${encodeURIComponent(server.value)}`,
			{
				method: 'PUT',
				body: { xaml: xaml.value },
			},
		)
		loadedXaml.value = xaml.value
		toast.add({ title: t('pclHomepage.saved'), color: 'success' })
		await refresh()
	} catch {
		toast.add({ title: t('errors.requestFailed'), color: 'error' })
	} finally {
		isSaving.value = false
	}
}

const handleEditorMount = (
	editor: MonacoEditorApi.IStandaloneCodeEditor,
	monaco: MonacoEditor,
) => {
	editor.onKeyDown((event) => {
		if (
			(event.ctrlKey || event.metaKey) &&
			!event.altKey &&
			event.keyCode === monaco.KeyCode.KeyS
		) {
			event.preventDefault()
			event.stopPropagation()
			void save()
			return
		}

		if (
			event.shiftKey &&
			event.altKey &&
			event.keyCode === monaco.KeyCode.KeyF
		) {
			event.preventDefault()
			event.stopPropagation()
			formatXaml(editor)
		}
	})
}
</script>

<template>
	<section class="space-y-6">
		<div class="flex flex-wrap items-start justify-between gap-4">
			<div>
				<UButton
					to="/launcher/pcl"
					color="neutral"
					variant="link"
					class="-ml-3"
				>
					<UIcon name="i-lucide-arrow-left" class="size-4" />
					{{ t('pclHomepage.back') }}
				</UButton>
				<h1 class="mt-2 text-3xl font-semibold tracking-tight">
					{{ data?.server.nameZhCn ?? t('pclHomepage.title') }}
				</h1>
				<p
					v-if="data"
					class="mt-2 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400"
				>
					<span>{{ data.server.serverId }}</span>
					<UBadge color="neutral" variant="soft" size="sm">
						{{ data.server.code }}
					</UBadge>
				</p>
			</div>
			<div class="flex flex-col items-end gap-2">
				<div class="flex items-center gap-2">
					<UTooltip :text="t('pclHomepage.variableHelp')">
						<UButton
							icon="i-lucide-info"
							color="neutral"
							variant="soft"
							:aria-label="t('pclHomepage.variableHelp')"
							@click="variableHelpOpen = true"
						/>
					</UTooltip>
					<UButton
						:loading="isSaving || status === 'pending'"
						color="primary"
						@click="save"
					>
						{{ t('actions.save') }}
					</UButton>
				</div>
				<p
					v-if="xaml !== loadedXaml"
					class="text-sm text-amber-600 dark:text-amber-400"
				>
					{{ t('pclHomepage.unsavedChanges') }}
				</p>
			</div>
		</div>

		<div
			class="h-[calc(100dvh-14rem)] overflow-hidden rounded-xl border border-slate-800 bg-slate-900"
		>
			<ClientOnly>
				<VueMonacoEditor
					v-model:value="xaml"
					language="xml"
					theme="hydcraft-pcl"
					:options="{
						automaticLayout: true,
						fontFamily: 'var(--font-mono)',
						minimap: { enabled: false },
						tabSize: 2,
						wordWrap: 'on',
					}"
					class="h-full w-full bg-slate-900 font-mono"
					@before-mount="configureEditorTheme"
					@mount="handleEditorMount"
				/>
				<template #fallback>
					<div class="flex flex-1 items-center justify-center p-8">
						<div class="w-full max-w-2xl space-y-4">
							<div class="flex items-center gap-3">
								<USkeleton class="size-5 rounded-full" />
								<USkeleton class="h-4 w-36" />
							</div>
							<USkeleton class="h-4 w-full" />
							<USkeleton class="h-4 w-4/5" />
							<USkeleton class="h-4 w-2/3" />
						</div>
					</div>
				</template>
			</ClientOnly>
		</div>
		<UModal
			v-model:open="variableHelpOpen"
			:title="t('pclHomepage.variableHelp')"
		>
			<template #body>
				<div class="space-y-4 text-sm">
					<p class="text-slate-600 dark:text-slate-300">
						{{ t('pclHomepage.variableDescription') }}
					</p>
					<dl class="space-y-3">
						<div>
							<dt v-pre class="font-mono font-medium">{{ server_status }}</dt>
							<dd class="mt-1 text-slate-500 dark:text-slate-400">
								{{ t('pclHomepage.variables.serverStatus') }}
							</dd>
						</div>
						<div>
							<dt v-pre class="font-mono font-medium">{{ online_players }}</dt>
							<dd class="mt-1 text-slate-500 dark:text-slate-400">
								{{ t('pclHomepage.variables.onlinePlayers') }}
							</dd>
						</div>
						<div>
							<dt v-pre class="font-mono font-medium">
								{{ latest_client_version }}
							</dt>
							<dd class="mt-1 text-slate-500 dark:text-slate-400">
								{{ t('pclHomepage.variables.latestClientVersion') }}
							</dd>
						</div>
						<div>
							<dt v-pre class="font-mono font-medium">
								{{ latest_client_published_at }}
							</dt>
							<dd class="mt-1 text-slate-500 dark:text-slate-400">
								{{ t('pclHomepage.variables.latestClientPublishedAt') }}
							</dd>
						</div>
						<div>
							<dt v-pre class="font-mono font-medium">
								{{ latest_client_publisher }}
							</dt>
							<dd class="mt-1 text-slate-500 dark:text-slate-400">
								{{ t('pclHomepage.variables.latestClientPublisher') }}
							</dd>
						</div>
						<div>
							<dt v-pre class="font-mono font-medium">{{ current_date }}</dt>
							<dd class="mt-1 text-slate-500 dark:text-slate-400">
								{{ t('pclHomepage.variables.currentDate') }}
							</dd>
						</div>
						<div>
							<dt v-pre class="font-mono font-medium">
								{{ today_request_count }}
							</dt>
							<dd class="mt-1 text-slate-500 dark:text-slate-400">
								{{ t('pclHomepage.variables.todayRequestCount') }}
							</dd>
						</div>
					</dl>
				</div>
			</template>
		</UModal>
	</section>
</template>

<style>
.monaco-editor .sticky-widget .sticky-line-content {
	background-color: var(--color-slate-900) !important;
}
</style>
