import type { Prisma } from '~/generated/prisma/client'
import type { ConsoleEventMap } from './types'

export const enqueuePostCommitEvent = async <T extends keyof ConsoleEventMap>(
	tx: Prisma.TransactionClient,
	type: T,
	payload: ConsoleEventMap[T],
) => tx.postCommitEvent.create({ data: { type, payload } })
