import { z } from 'zod'

const version = z.string().regex(/^\d+\.\d+\.\d+\.\d+$/)
const sha256 = z.string().regex(/^[a-f0-9]{64}$/i)
const safePath = z
	.string()
	.min(1)
	.max(2048)
	.refine(
		(value) =>
			!value.startsWith('/') &&
			!value.includes('\\') &&
			!value.split('/').includes('..'),
		'UPDATE_PATH_INVALID',
	)

export const clientReleaseSchema = z.object({
	channel: z
		.string()
		.regex(/^[a-z0-9-]+$/)
		.default('stable'),
	version,
	manifest: z.object({
		clientId: z.string().min(1),
		managedRoots: z.array(safePath).min(1),
		description: z.string().max(4000).optional(),
	}),
})

export const clientMigrationSchema = z.object({
	channel: z
		.string()
		.regex(/^[a-z0-9-]+$/)
		.default('stable'),
	fromVersion: version,
	toVersion: version,
	packageKey: safePath,
	packageSha256: sha256,
	packageSize: z.number().int().positive(),
	signature: z.string().min(32),
	plan: z.object({
		schemaVersion: z.literal(1),
		migrationId: z.string().min(1),
		fromVersion: version,
		toVersion: version,
		operations: z
			.array(
				z
					.object({ id: z.string().min(1), type: z.string().min(1) })
					.passthrough(),
			)
			.min(1),
	}),
	anchors: z.array(z.object({ path: safePath, sha256 })).min(1),
})

export type ClientReleaseInput = z.infer<typeof clientReleaseSchema>
export type ClientMigrationInput = z.infer<typeof clientMigrationSchema>
