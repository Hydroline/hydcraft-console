import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
	compatibilityDate: '2026-07-11',
	devtools: { enabled: true },
	modules: ['@nuxt/ui', '@nuxt/eslint', '@nuxtjs/i18n'],
	css: [
		'~/assets/styles/fonts/index.css',
		'~/assets/styles/base/main.css',
		'~/assets/styles/base/tailwind.css',
	],
	vite: { plugins: [tailwindcss()] },
	app: {
		pageTransition: { name: 'page', mode: 'out-in' },
		head: {
			title: 'HydCraft Console',
			link: [
				{
					rel: 'icon',
					type: 'image/x-icon',
					href: '/favicon.ico',
				},
			],
		},
	},
	colorMode: {
		preference: 'system',
		storage: 'cookie',
	},
	i18n: {
		defaultLocale: 'zh-CN',
		strategy: 'no_prefix',
		langDir: '../locales',
		locales: [
			{ code: 'zh-CN', language: 'zh-CN', file: 'zh-CN/console.json' },
			{ code: 'zh-TW', language: 'zh-TW', file: 'zh-TW/console.json' },
			{ code: 'ja-JP', language: 'ja-JP', file: 'ja-JP/console.json' },
			{ code: 'en-US', language: 'en-US', file: 'en-US/console.json' },
		],
	},
	icon: {
		clientBundle: { icons: [] },
		serverBundle: { collections: ['lucide'] },
		fallbackToApi: false,
	},
	typescript: { strict: true },
	runtimeConfig: {
		databaseUrl: '',
		sessionSecret: '',
		hydrolineIssuer:
			process.env.NUXT_HYDROLINE_ISSUER ?? process.env.NUXT_OIDC_ISSUER ?? '',
		oidcClientId: '',
		oidcClientSecret: '',
		oidcRedirectUri: '',
		updaterDesktopScheme: 'hydcraft-updater',
		sourceSecretEncryptionKey: '',
		publicSourceOrigins: {
			dlR2: 'https://dl-r2.hydcraft.cn',
			dlR2Cn: 'https://dl-r2-cn.hydcraft.cn',
			dlShanghaiCdn: 'https://dl-shanghai-cdn.hydcraft.cn',
		},
		public: { consoleOrigin: 'http://localhost:3000' },
	},
	ui: {
		colorMode: true,
		fonts: false,
		theme: {
			colors: ['primary', 'error', 'success', 'warning', 'neutral'],
			defaultVariants: {
				color: 'neutral',
				size: 'sm',
			},
		},
	},
})
