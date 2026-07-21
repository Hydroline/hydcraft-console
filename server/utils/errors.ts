import { createError } from 'h3'

export const createApiError = (statusCode: number, code: string) =>
	createError({ statusCode, statusMessage: code, data: { code } })
