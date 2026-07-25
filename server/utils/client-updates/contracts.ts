import { z } from 'zod'

const version = z.string().regex(/^\d+\.\d+\.\d+(?:\.\d+)?$/)
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
const basePackage = z.object({
	packageKey: safePath,
	packageSha256: sha256,
	packageSize: z.number().int().positive(),
	signature: z.string().min(32),
	signaturePayload: z.literal('sha256').optional(),
	sources: z.array(z.string().url()).min(1),
})

const clientModSchema = z.object({
	id: z.string().min(1).max(256),
	name: z.string().min(1).max(256),
	version: z.string().min(1).max(256),
	description: z.string().max(4000).optional(),
	api: z.string().max(256).optional(),
})

const clientMetadataSchema = z.object({
	apiVersion: z.string().min(1).max(256),
	mods: z.array(clientModSchema).max(5000),
})

export const clientReleaseSchema = z.object({
	version,
	manifest: z.object({
		clientId: z.string().min(1),
		managedRoots: z.array(safePath).min(1),
		description: z.string().max(4000).optional(),
		readme: z.string().max(20000).optional(),
		changelog: z.string().max(20000).optional(),
		metadata: clientMetadataSchema.optional(),
		base: basePackage.optional(),
	}),
})

export const clientMigrationSchema = z.object({
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
