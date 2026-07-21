import { z } from 'zod'

export const localizedTextSchema = z.object({
	'zh-CN': z.string().min(1),
	'zh-TW': z.string().optional(),
	'ja-JP': z.string().optional(),
	'en-US': z.string().optional(),
})

export const safeRelativePath = z
	.string()
	.min(1)
	.max(2048)
	.refine(
		(value) =>
			!value.startsWith('/') &&
			!value.includes('\\') &&
			!value.split('/').includes('..'),
		'RELEASE_PATH_INVALID',
	)

export const accessPolicySchema = z.object({
	requiresLogin: z.boolean().default(false),
	minimumRole: z.enum(['USER', 'ADMIN', 'OWNER']).optional(),
	entitlementMode: z.enum(['ANY', 'ALL']).default('ANY'),
	entitlements: z.array(z.string()).default([]),
})

export const updaterManifestSchema = z.object({
	schemaVersion: z.literal(1),
	version: z
		.string()
		.regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/),
	platform: z.enum(['windows-x86_64', 'macos-universal']),
	urls: z.array(z.string().url()).min(1),
	sha256: z.string().regex(/^[a-f0-9]{64}$/i),
})
