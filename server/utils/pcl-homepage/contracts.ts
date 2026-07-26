import { z } from 'zod'

export const pclHomepageInputSchema = z.object({
	xaml: z.string().trim().min(1).max(200_000),
})

export type PclHomepageInput = z.infer<typeof pclHomepageInputSchema>
