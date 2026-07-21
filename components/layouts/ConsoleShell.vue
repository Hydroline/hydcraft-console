<script setup lang="ts">
const { t, locale, setLocale } = useI18n()
const route = useRoute()
const toast = useToast()
const colorMode = useNuxtApp().$colorMode
const mobileOpen = ref(false)
const localeMenuOpen = ref(false)
const collapsed = useState('console-sidebar-collapsed', () => false)
const { data: me, refresh } = await useFetch('/api/auth/me')
const user = computed(() => me.value?.identity)
const authenticated = computed(() => Boolean(user.value))
const entries = computed(() => [
	{ to: '/releases', label: t('nav.releases'), icon: 'i-lucide-rocket' },
	{
		to: '/distribution',
		label: t('nav.distribution'),
		icon: 'i-lucide-network',
	},
	{ to: '/access', label: t('nav.access'), icon: 'i-lucide-shield-check' },
	{ to: '/audit', label: t('nav.audit'), icon: 'i-lucide-scroll-text' },
	{ to: '/settings', label: t('nav.settings'), icon: 'i-lucide-settings-2' },
])
type ThemeMode = 'light' | 'dark' | 'system'

const themeIconMap = {
	light: 'i-lucide-sun',
	dark: 'i-lucide-moon',
} as const
const getThemeModeIcon = (mode: ThemeMode): string =>
	mode === 'system' ? 'i-lucide-monitor' : themeIconMap[mode]
const active = (to: string) => route.path === to
const themeModes = computed(
	() =>
		[
			{ value: 'light', label: t('actions.themeLight'), icon: 'i-lucide-sun' },
			{ value: 'dark', label: t('actions.themeDark'), icon: 'i-lucide-moon' },
			{
				value: 'system',
				label: t('actions.themeSystem'),
				icon: 'i-lucide-monitor',
			},
		] as const,
)
const selectedThemeMode = computed<ThemeMode>(() => {
	const preference = colorMode.preference

	return preference === 'light' ||
		preference === 'dark' ||
		preference === 'system'
		? preference
		: 'system'
})
const themeButtonIcon = computed(() =>
	getThemeModeIcon(selectedThemeMode.value),
)
const selectTheme = (nextTheme: ThemeMode): void => {
	colorMode.preference = nextTheme
}
const localeItems = [
	{ label: '简体中文', value: 'zh-CN' },
	{ label: '繁體中文', value: 'zh-TW' },
	{ label: '日本語', value: 'ja-JP' },
	{ label: 'English', value: 'en-US' },
] as const
const selectLocale = async (
	nextLocale: 'zh-CN' | 'zh-TW' | 'ja-JP' | 'en-US',
) => {
	await setLocale(nextLocale)
	localeMenuOpen.value = false
}
const logout = async () => {
	if (!authenticated.value) return
	await $fetch('/api/auth/logout', { method: 'POST' })
	toast.add({ title: t('auth.signedOut'), color: 'success' })
	await refresh()
	await navigateTo('/signed-out')
}
</script>

<template>
	<div
		class="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100"
	>
		<aside
			class="fixed inset-y-0 left-0 z-40 hidden border-r border-slate-200 bg-white/95 p-3 backdrop-blur transition-[width] duration-300 ease-out dark:border-slate-800 dark:bg-slate-950/95 lg:flex lg:flex-col"
			:class="collapsed ? 'w-18' : 'w-70'"
		>
			<div
				class="mb-7 flex items-center gap-3 px-2 py-1"
				:class="collapsed ? 'justify-center' : ''"
			>
				<div
					class="grid size-9 shrink-0 place-items-center rounded-xl bg-primary-500 text-white shadow-sm"
				>
					<UIcon name="i-lucide-box" class="size-5" />
				</div>
				<span
					class="overflow-hidden whitespace-nowrap font-semibold tracking-tight transition-[max-width,opacity] duration-200"
					:class="collapsed ? 'max-w-0 opacity-0' : 'max-w-48 opacity-100'"
					>HydCraft Console</span
				>
			</div>
			<nav class="space-y-1" :class="collapsed ? 'space-y-2' : ''">
				<NuxtLink
					v-for="item in entries"
					:key="item.to"
					:to="item.to"
					class="flex items-center overflow-hidden rounded-lg py-2 text-sm transition-[background-color,color,padding] duration-200"
					:class="[
						active(item.to)
							? 'bg-primary-100/60 text-primary-700 dark:bg-primary-500/20 dark:text-primary-200'
							: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white',
						collapsed ? 'justify-center px-2' : 'gap-3 px-3',
					]"
					:title="collapsed ? item.label : undefined"
				>
					<UIcon :name="item.icon" class="size-5 shrink-0" />
					<span
						class="overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-200"
						:class="collapsed ? 'max-w-0 opacity-0' : 'max-w-40 opacity-100'"
						>{{ item.label }}</span
					>
				</NuxtLink>
			</nav>
			<div class="mt-auto space-y-2">
				<div
					v-if="authenticated"
					class="flex rounded-xl border border-slate-200 bg-slate-50 text-xs dark:border-slate-800 dark:bg-slate-900"
					:class="
						collapsed
							? 'flex-col items-center gap-1 p-1.5'
							: 'items-center gap-3 p-3'
					"
				>
					<UAvatar
						:src="user?.avatarUrl || undefined"
						:alt="user?.displayName || user?.username"
						size="sm"
					/>
					<div v-if="!collapsed" class="min-w-0 flex-1">
						<p class="truncate font-medium">
							{{ user?.displayName || user?.username }}
						</p>
						<p class="truncate text-slate-500 dark:text-slate-400">
							{{ user?.hydrolineId }}
						</p>
					</div>
					<UButton
						icon="i-lucide-log-out"
						color="neutral"
						variant="ghost"
						size="xs"
						:aria-label="t('actions.logout')"
						@click="logout"
					/>
				</div>
				<UButton
					v-if="!authenticated"
					to="/api/oidc/hydcraft/login"
					external
					icon="i-lucide-log-in"
					:label="collapsed ? undefined : t('auth.signIn')"
					color="primary"
					variant="soft"
					:aria-label="t('auth.signIn')"
					:class="collapsed ? 'size-9 justify-center' : 'w-full justify-start'"
				/>
				<div
					class="flex gap-1"
					:class="collapsed ? 'flex-col items-center' : ''"
				>
					<UPopover>
						<UButton
							:icon="themeButtonIcon"
							color="neutral"
							variant="ghost"
							:class="collapsed ? 'size-9 justify-center' : ''"
							:aria-label="t('actions.theme')"
						/>
						<template #content>
							<div class="flex w-40 flex-col gap-1 p-2">
								<UButton
									v-for="mode in themeModes"
									:key="mode.value"
									color="neutral"
									variant="ghost"
									class="w-full justify-start gap-2 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-slate-100 dark:hover:bg-slate-800"
									:class="{
										'bg-primary-100/60 text-primary-600 dark:bg-primary-500/20 dark:text-primary-200':
											selectedThemeMode === mode.value,
										'text-slate-600 dark:text-slate-300':
											selectedThemeMode !== mode.value,
									}"
									@click="selectTheme(mode.value)"
								>
									<UIcon :name="mode.icon" class="size-4" />
									<span>{{ mode.label }}</span>
									<UIcon
										v-if="selectedThemeMode === mode.value"
										name="i-lucide-check"
										class="ml-auto size-4"
									/>
								</UButton>
							</div>
						</template>
					</UPopover>
					<UPopover v-model:open="localeMenuOpen">
						<UButton
							icon="i-lucide-languages"
							color="neutral"
							variant="ghost"
							:class="collapsed ? 'size-9 justify-center' : ''"
							:aria-label="t('actions.language')"
						/>
						<template #content>
							<div class="flex w-40 flex-col gap-1 p-2">
								<UButton
									v-for="item in localeItems"
									:key="item.value"
									color="neutral"
									variant="ghost"
									class="w-full justify-start gap-2 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-slate-100 dark:hover:bg-slate-800"
									:class="{
										'bg-primary-100/60 text-primary-600 dark:bg-primary-500/20 dark:text-primary-200':
											locale === item.value,
										'text-slate-600 dark:text-slate-300': locale !== item.value,
									}"
									@click="selectLocale(item.value)"
								>
									<span>{{ item.label }}</span>
									<UIcon
										v-if="locale === item.value"
										name="i-lucide-check"
										class="ml-auto size-4"
									/>
								</UButton>
							</div>
						</template>
					</UPopover>
					<UButton
						:icon="
							collapsed
								? 'i-lucide-panel-left-open'
								: 'i-lucide-panel-left-close'
						"
						color="neutral"
						variant="ghost"
						:class="collapsed ? 'size-9 justify-center' : ''"
						:aria-label="t('actions.collapse')"
						@click="collapsed = !collapsed"
					/>
				</div>
			</div>
		</aside>
		<div class="lg:hidden">
			<UButton
				class="fixed left-3 top-3 z-30"
				icon="i-lucide-menu"
				color="neutral"
				variant="soft"
				@click="mobileOpen = true"
			/><USlideover
				v-model:open="mobileOpen"
				side="left"
				:title="'HydCraft Console'"
				><template #body
					><nav class="space-y-2">
						<NuxtLink
							v-for="item in entries"
							:key="item.to"
							:to="item.to"
							class="flex items-center gap-3 rounded-lg px-3 py-2"
							@click="mobileOpen = false"
							><UIcon :name="item.icon" class="size-5" />{{
								item.label
							}}</NuxtLink
						>
					</nav></template
				></USlideover
			>
		</div>
		<main
			class="min-h-screen p-7 pt-28 transition-[padding] duration-300 ease-out lg:py-12 lg:pr-12"
			:class="
				collapsed ? 'lg:pl-[calc(4.5rem+3rem)]' : 'lg:pl-[calc(17.5rem+3rem)]'
			"
		>
			<div class="mx-auto w-full max-w-[84rem]"><slot /></div>
		</main>
	</div>
</template>
