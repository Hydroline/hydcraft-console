import { prisma } from '../utils/db/prisma'

export default defineNitroPlugin(() => {
	const dispatch = async () => {
		const events = await prisma.postCommitEvent.findMany({
			where: { dispatchedAt: null },
			orderBy: { createdAt: 'asc' },
			take: 100,
		})
		for (const event of events) {
			if (event.type === 'audit.log') {
				const payload = event.payload as {
					action: 'CREATED' | 'UPDATED' | 'PUBLISHED' | 'REVOKED' | 'LOGGED_OUT'
					resource: string
					resourceId: string
					actorId?: string
					payload?: Record<string, unknown>
				}
				await prisma.auditLog.create({ data: payload })
			}
			await prisma.postCommitEvent.update({
				where: { id: event.id },
				data: { dispatchedAt: new Date() },
			})
		}
	}
	setInterval(() => void dispatch(), 3_000).unref()
	void dispatch()
})
