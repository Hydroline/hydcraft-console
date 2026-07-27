<script setup lang="ts">
const { t, locale, setLocale } = useI18n()
const route = useRoute()
const toast = useToast()
const colorMode = useNuxtApp().$colorMode
const mobileOpen = ref(false)
const localeMenuOpen = ref(false)
const themeMenuOpen = ref(false)
const accountMenuOpen = ref(false)
const collapsed = useState('console-sidebar-collapsed', () => false)
const { data: me, refresh } = await useFetch('/api/auth/me')
const { isStartingOidcLogin, startOidcLogin } = useHydcraftOidcLogin()
const pageContentVisible = ref(true)
let startPageContentFrame: number | undefined
let revealPageContentFrame: number | undefined
const user = computed(() => me.value?.identity)
const authenticated = computed(() => Boolean(user.value))
const profileUrl = computed(() =>
	user.value?.username
		? `https://hydcraft.cn/u/${encodeURIComponent(user.value.username)}`
		: undefined,
)
const isAdministrator = computed(() =>
	['ADMIN', 'OWNER'].includes(user.value?.role.toUpperCase() ?? ''),
)
const entries = computed(() => {
	const home = { to: '/', label: t('nav.home'), icon: 'i-lucide-house' }
	if (!isAdministrator.value) return [home]

	return [
		home,
		{ to: '/releases', label: t('nav.releases'), icon: 'i-lucide-rocket' },
		{
			to: '/launcher/pcl',
			label: t('nav.pclHomepage'),
			icon: 'i-lucide-panels-top-left',
		},
		{
			to: '/distribution',
			label: t('nav.distribution'),
			icon: 'i-lucide-network',
		},
		{ to: '/access', label: t('nav.access'), icon: 'i-lucide-shield-check' },
		{ to: '/audit', label: t('nav.audit'), icon: 'i-lucide-scroll-text' },
		{ to: '/settings', label: t('nav.settings'), icon: 'i-lucide-settings-2' },
	]
})
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
	themeMenuOpen.value = false
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
	accountMenuOpen.value = false
	await refresh()
	if (route.meta.public !== true) await navigateTo('/', { replace: true })
}

watch(
	() => route.fullPath,
	() => {
		if (
			!import.meta.client ||
			window.matchMedia('(prefers-reduced-motion: reduce)').matches
		)
			return

		if (startPageContentFrame) cancelAnimationFrame(startPageContentFrame)
		if (revealPageContentFrame) cancelAnimationFrame(revealPageContentFrame)
		pageContentVisible.value = false
		startPageContentFrame = requestAnimationFrame(() => {
			revealPageContentFrame = requestAnimationFrame(() => {
				pageContentVisible.value = true
			})
		})
	},
	{ flush: 'pre' },
)

onBeforeUnmount(() => {
	if (startPageContentFrame) cancelAnimationFrame(startPageContentFrame)
	if (revealPageContentFrame) cancelAnimationFrame(revealPageContentFrame)
})
</script>

<template>
	<div
		class="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100"
	>
		<aside
			class="fixed inset-y-0 left-0 z-40 hidden border-r border-slate-200 bg-white/95 p-3 backdrop-blur transition-[width] duration-300 ease-out dark:border-slate-800 dark:bg-slate-900/95 lg:flex lg:flex-col"
			:class="collapsed ? 'w-20' : 'w-70'"
		>
			<div class="relative mb-2 h-32 p-2">
				<div
					class="absolute left-2 top-2 overflow-hidden whitespace-nowrap font-semibold tracking-tight transition-opacity duration-200"
					:class="collapsed ? 'pointer-events-none opacity-0' : 'opacity-100'"
				>
					<div class="ml-0.5 text-base font-normal">HydCraft</div>
					<div class="-mt-1 text-3xl">Console</div>
					<div
						class="ml-0.5 mt-1 text-slate-500 dark:text-slate-400 font-normal text-sm tracking-wide"
						v-if="locale !== 'en-US'"
					>
						{{ t('home.subtitle') }}
					</div>
				</div>
				<div
					class="absolute inset-x-2 top-2 flex flex-col items-center gap-3 transition-opacity duration-200"
					:class="collapsed ? 'opacity-100' : 'pointer-events-none opacity-0'"
				>
					<UIcon name="i-lucide-box" class="size-8" />
					<UButton
						color="neutral"
						variant="ghost"
						size="xs"
						class="h-9 w-9 rounded-full hover:bg-slate-500/10 active:bg-slate-500/20"
						icon-only
						:aria-label="t('actions.collapse')"
						@click="collapsed = false"
					>
						<UIcon name="i-lucide-panel-left-open" class="h-6 w-6" />
					</UButton>
				</div>
				<UButton
					color="neutral"
					variant="ghost"
					size="xs"
					class="absolute right-2 top-2 h-9 w-9 rounded-full transition-opacity duration-200 hover:bg-slate-500/10 active:bg-slate-500/20"
					:class="collapsed ? 'pointer-events-none opacity-0' : 'opacity-100'"
					icon-only
					:aria-label="t('actions.collapse')"
					@click="collapsed = true"
				>
					<UIcon name="i-lucide-panel-left-close" class="h-6 w-6" />
				</UButton>
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
			<div class="mt-auto">
				<div
					class="flex items-center transition-all duration-200"
					:class="collapsed ? 'flex-col gap-2' : ''"
				>
					<div
						class="flex flex-1 items-center gap-2 transition-all duration-200"
						:class="collapsed ? 'flex-none flex-col' : ''"
					>
						<UPopover
							v-model:open="themeMenuOpen"
							:popper="{ placement: 'top-start' }"
						>
							<UButton
								color="neutral"
								variant="ghost"
								size="xs"
								class="h-9 w-9 rounded-full hover:bg-slate-500/10 active:bg-slate-500/20"
								icon-only
								:aria-label="t('actions.theme')"
							>
								<UIcon :name="themeButtonIcon" class="h-6 w-6" />
							</UButton>
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
						<UPopover
							v-model:open="localeMenuOpen"
							:popper="{ placement: 'top-start' }"
						>
							<UButton
								color="neutral"
								variant="ghost"
								size="xs"
								class="h-9 w-9 rounded-full hover:bg-slate-500/10 active:bg-slate-500/20"
								icon-only
								:aria-label="t('actions.language')"
							>
								<UIcon name="i-lucide-languages" class="h-6 w-6" />
							</UButton>
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
											'text-slate-600 dark:text-slate-300':
												locale !== item.value,
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
					</div>
					<div :class="collapsed ? 'order-first' : 'order-last'">
						<UButton
							v-if="!authenticated"
							color="neutral"
							variant="link"
							size="xs"
							class="px-2 text-sm whitespace-nowrap transition-opacity duration-200 hover:opacity-80"
							:loading="isStartingOidcLogin"
							@click="startOidcLogin"
						>
							{{ t('auth.signIn') }}
						</UButton>
						<UPopover
							v-else
							v-model:open="accountMenuOpen"
							:popper="{ placement: collapsed ? 'right-end' : 'top-end' }"
						>
							<button
								type="button"
								class="ml-0.5 flex h-9 items-center justify-center gap-1 rounded-full border-0 bg-transparent py-0 pr-1.5 pl-0 transition duration-150 hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
								:aria-label="user?.displayName || user?.username"
							>
								<span
									class="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-200 text-sm font-semibold text-slate-700 ring ring-slate-200 transition duration-200 dark:bg-slate-700 dark:text-slate-100 dark:ring-slate-700"
								>
									<CommonAvatarSkeletonImage
										v-if="user?.avatarUrl"
										:src="user.avatarUrl"
										:alt="user.displayName || user.username"
										image-class="h-full w-full object-cover"
										class="h-full w-full"
									/>
									<span v-else class="leading-none">{{
										(user?.displayName || user?.username || '?').slice(0, 1)
									}}</span>
								</span>
								<UIcon
									v-if="!collapsed"
									name="i-lucide-chevron-up"
									class="h-3.5 w-3.5 opacity-80 transition duration-200"
									:class="{ 'rotate-180': accountMenuOpen }"
								/>
							</button>
							<template #content>
								<div class="flex min-w-40 flex-col gap-1 p-2">
									<div class="px-3 py-2">
										<div
											class="line-clamp-2 wrap-break-word text-[17px] leading-snug font-semibold text-slate-600 dark:text-slate-300"
										>
											{{ user?.displayName || user?.username }}
										</div>
										<div
											class="text-[13px] leading-[normal] text-slate-500/80 dark:text-slate-400/80"
										>
											{{ user?.hydrolineId }}
										</div>
									</div>
									<UButton
										v-if="profileUrl"
										:to="profileUrl"
										external
										target="_blank"
										rel="noopener noreferrer"
										color="neutral"
										variant="ghost"
										class="w-full justify-start gap-1.5 rounded-lg px-3 py-2 text-left text-sm text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
									>
										<UIcon name="i-lucide-user" class="h-4.5 w-4.5 shrink-0" />
										<span class="leading-[normal] min-w-0 truncate">{{
											t('actions.profile')
										}}</span>
									</UButton>
									<div
										class="my-1 border-t border-slate-200 dark:border-slate-700"
									/>
									<UButton
										color="error"
										variant="ghost"
										class="w-full justify-start gap-1.5 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-error-50! active:bg-error-100! dark:hover:bg-error-900/25! dark:active:bg-error-900/35!"
										@click="logout"
									>
										<UIcon
											name="i-lucide-log-out"
											class="h-4.5 w-4.5 shrink-0"
										/>
										<span class="leading-[normal] min-w-0 truncate">{{
											t('actions.logout')
										}}</span>
									</UButton>
								</div>
							</template>
						</UPopover>
					</div>
				</div>
				<p
					v-if="!collapsed"
					class="mt-2 text-center text-xs text-slate-400 transition-opacity duration-200 dark:text-slate-600"
				>
					Copyright © 2018 — 2026 HydCraft. All Rights Reserved.
				</p>
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
					><div class="flex min-h-full flex-col">
						<nav class="space-y-2">
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
						</nav>
						<div class="mt-auto flex items-center">
							<div class="flex flex-1 items-center gap-2">
								<UPopover
									v-model:open="themeMenuOpen"
									:popper="{ placement: 'top-start' }"
								>
									<UButton
										color="neutral"
										variant="ghost"
										size="xs"
										class="h-9 w-9 rounded-full hover:bg-slate-500/10 active:bg-slate-500/20"
										icon-only
										:aria-label="t('actions.theme')"
									>
										<UIcon :name="themeButtonIcon" class="h-6 w-6" />
									</UButton>
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
											</UButton>
										</div>
									</template>
								</UPopover>
								<UPopover
									v-model:open="localeMenuOpen"
									:popper="{ placement: 'top-start' }"
								>
									<UButton
										color="neutral"
										variant="ghost"
										size="xs"
										class="h-9 w-9 rounded-full hover:bg-slate-500/10 active:bg-slate-500/20"
										icon-only
										:aria-label="t('actions.language')"
									>
										<UIcon name="i-lucide-languages" class="h-6 w-6" />
									</UButton>
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
													'text-slate-600 dark:text-slate-300':
														locale !== item.value,
												}"
												@click="selectLocale(item.value)"
											>
												<span>{{ item.label }}</span>
											</UButton>
										</div>
									</template>
								</UPopover>
							</div>
							<UButton
								v-if="!authenticated"
								color="neutral"
								variant="link"
								size="xs"
								class="px-2 text-sm whitespace-nowrap transition-opacity duration-200 hover:opacity-80"
								:loading="isStartingOidcLogin"
								@click="startOidcLogin"
								>{{ t('auth.signIn') }}</UButton
							>
							<UPopover
								v-else
								v-model:open="accountMenuOpen"
								:popper="{ placement: 'top-end' }"
							>
								<button
									type="button"
									class="ml-0.5 flex h-9 items-center justify-center gap-1 rounded-full border-0 bg-transparent py-0 pr-1.5 pl-0 transition duration-150 hover:opacity-80"
									:aria-label="user?.displayName || user?.username"
								>
									<span
										class="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-200 text-sm font-semibold text-slate-700 ring ring-slate-200 dark:bg-slate-700 dark:text-slate-100 dark:ring-slate-700"
									>
										<CommonAvatarSkeletonImage
											v-if="user?.avatarUrl"
											:src="user.avatarUrl"
											:alt="user.displayName || user.username"
											image-class="h-full w-full object-cover"
											class="h-full w-full"
										/>
										<span v-else class="leading-none">{{
											(user?.displayName || user?.username || '?').slice(0, 1)
										}}</span>
									</span>
									<UIcon
										name="i-lucide-chevron-up"
										class="h-3.5 w-3.5 opacity-80 transition duration-200"
										:class="{ 'rotate-180': accountMenuOpen }"
									/>
								</button>
								<template #content>
									<div class="flex min-w-40 flex-col gap-1 p-2">
										<div class="px-3 py-2">
											<div
												class="line-clamp-2 wrap-break-word text-[17px] leading-snug font-semibold text-slate-600 dark:text-slate-300"
											>
												{{ user?.displayName || user?.username }}
											</div>
											<div
												class="text-[13px] leading-[normal] text-slate-500/80 dark:text-slate-400/80"
											>
												{{ user?.hydrolineId }}
											</div>
										</div>
										<UButton
											v-if="profileUrl"
											:to="profileUrl"
											external
											target="_blank"
											rel="noopener noreferrer"
											color="neutral"
											variant="ghost"
											class="w-full justify-start gap-1.5 rounded-lg px-3 py-2 text-left text-sm text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
											><UIcon
												name="i-lucide-user"
												class="h-4.5 w-4.5 shrink-0"
											/><span>{{ t('actions.profile') }}</span></UButton
										>
										<div
											class="my-1 border-t border-slate-200 dark:border-slate-700"
										/>
										<UButton
											color="error"
											variant="ghost"
											class="w-full justify-start gap-1.5 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-error-50! dark:hover:bg-error-900/25!"
											@click="logout"
											><UIcon
												name="i-lucide-log-out"
												class="h-4.5 w-4.5 shrink-0"
											/><span>{{ t('actions.logout') }}</span></UButton
										>
									</div>
								</template>
							</UPopover>
						</div>
					</div></template
				></USlideover
			>
		</div>
		<main
			class="min-h-screen p-7 pt-28 transition-[padding] duration-300 ease-out lg:pb-6 lg:pt-12 lg:pr-12"
			:class="
				collapsed ? 'lg:pl-[calc(5rem+3rem)]' : 'lg:pl-[calc(17.5rem+3rem)]'
			"
		>
			<div
				class="mx-auto w-full max-w-[84rem] transition-[opacity,transform] duration-300 ease-out motion-reduce:translate-y-0 motion-reduce:transition-none"
				:class="
					pageContentVisible
						? 'translate-y-0 opacity-100'
						: 'translate-y-2 opacity-0'
				"
			>
				<slot />
			</div>
		</main>
	</div>
</template>
