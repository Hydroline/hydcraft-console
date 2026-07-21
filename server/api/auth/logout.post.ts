import { revokeConsoleSession } from '../../utils/auth/session'

export default defineEventHandler(async (event) => {
	const token = getCookie(event, 'hydcraft_console_session')
	if (token) await revokeConsoleSession(token)
	deleteCookie(event, 'hydcraft_console_session', { path: '/' })
	return { ok: true }
})
