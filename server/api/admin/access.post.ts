import { z } from 'zod'
import { requireAdministrator } from '../../utils/auth/session'
import { prisma } from '../../utils/db/prisma'
import { createApiError } from '../../utils/errors'

const schema = z.object({
	subject: z.object({
		id: z.string(),
		hydrolineId: z.string(),
		username: z.string(),
		displayName: z.string().nullable().optional(),
		avatarUrl: z.string().nullable().optional(),
		role: z.string(),
	}),
	entitlementKeys: z.array(z.string()),
})
export default defineEventHandler(async (event) => {
	await requireAdministrator(event)
	const input = schema.parse(await readBody(event))
	const definitions = await prisma.entitlementDefinition.findMany({
		where: { key: { in: input.entitlementKeys }, enabled: true },
	})
	if (definitions.length !== input.entitlementKeys.length)
		throw createApiError(400, 'ENTITLEMENT_REFERENCE_INVALID')
	await prisma.consoleSubject.upsert({
		where: { id: input.subject.id },
		create: {
			id: input.subject.id,
			hydrolineId: input.subject.hydrolineId,
			username: input.subject.username,
			displayName: input.subject.displayName,
			avatarUrl: input.subject.avatarUrl,
			role: input.subject.role,
		},
		update: {
			hydrolineId: input.subject.hydrolineId,
			username: input.subject.username,
			displayName: input.subject.displayName,
			avatarUrl: input.subject.avatarUrl,
			role: input.subject.role,
			lastSeenAt: new Date(),
		},
	})
	await prisma.$transaction(async (tx) => {
		await tx.subjectEntitlement.deleteMany({
			where: { subjectId: input.subject.id },
		})
		if (definitions.length)
			await tx.subjectEntitlement.createMany({
				data: definitions.map((item) => ({
					subjectId: input.subject.id,
					entitlementId: item.id,
				})),
			})
	})
	return { ok: true }
})
