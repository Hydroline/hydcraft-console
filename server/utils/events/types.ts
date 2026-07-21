export interface ConsoleEventMap {
	'release.created': {
		resourceId: string
		kind: 'client-release' | 'client-migration'
		actorId?: string
	}
	'migration.published': {
		resourceId: string
		actorId: string
	}
	'audit.log': {
		action: 'CREATED' | 'UPDATED' | 'PUBLISHED' | 'REVOKED' | 'LOGGED_OUT'
		resource: string
		resourceId: string
		actorId?: string
		payload?: Record<string, unknown>
	}
}
