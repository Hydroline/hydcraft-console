import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { PrismaClient } from '~/generated/prisma/client'

declare global {
	var __hydcraftConsolePrisma__: PrismaClient | undefined
	var __hydcraftConsolePool__: Pool | undefined
}

const pool =
	globalThis.__hydcraftConsolePool__ ??
	new Pool({
		connectionString:
			process.env.DATABASE_URL ?? process.env.NUXT_DATABASE_URL ?? '',
	})
if (process.env.NODE_ENV !== 'production')
	globalThis.__hydcraftConsolePool__ = pool

export const prisma =
	globalThis.__hydcraftConsolePrisma__ ??
	new PrismaClient({
		adapter: new PrismaPg(pool),
		log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
	})
if (process.env.NODE_ENV !== 'production')
	globalThis.__hydcraftConsolePrisma__ = prisma
