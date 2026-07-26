import { prisma } from '../db/prisma'
import { createApiError } from '../errors'
import { enqueuePostCommitEvent } from '../events/post-commit'
import type { PclHomepageInput } from './contracts'

interface PortalServer {
	id: string
	serverId: string
	code: string
	shortCode: string
	nameZhCn: string
	nameZhTw: string
	nameEnUs: string
	nameJaJp: string
	status: string
}

interface PortalServersResponse {
	servers: PortalServer[]
}

interface PortalLiveServer {
	serverId: string
	bridgeStatus: {
		connected: boolean
		onlineCount: number
	}
}

interface PortalLiveOverviewResponse {
	servers: PortalLiveServer[]
}

export interface PclHomepageServer extends PortalServer {
	configured: boolean
	requestCount: number
}

interface PclTemplateVariables {
	serverStatus: string
	onlinePlayers: string
	latestClientVersion: string
	latestClientPublishedAt: string
	latestClientPublisher: string
	currentDate: string
	todayRequestCount: string
}

const dayMilliseconds = 24 * 60 * 60 * 1000

const portalOrigin = () =>
	String(useRuntimeConfig().hydrolineIssuer).replace(/\/$/, '')

const fetchPortalJson = async <T>(path: string): Promise<T> => {
	const response = await fetch(`${portalOrigin()}${path}`)
	if (!response.ok) throw createApiError(502, 'PORTAL_SERVERS_UNAVAILABLE')
	return (await response.json()) as T
}

const listPortalServers = async () =>
	(await fetchPortalJson<PortalServersResponse>('/api/public/launcher/servers'))
		.servers

const normalizeIdentifier = (value: string) => value.trim().toLocaleLowerCase()

const shanghaiDayStart = (date: Date) => {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone: 'Asia/Shanghai',
		year: 'numeric',
		month: 'numeric',
		day: 'numeric',
	}).formatToParts(date)
	const value = (type: Intl.DateTimeFormatPartTypes) =>
		Number(parts.find((part) => part.type === type)?.value ?? 0)
	return new Date(Date.UTC(value('year'), value('month') - 1, value('day'), -8))
}

const retainedPclRequestDay = () =>
	new Date(shanghaiDayStart(new Date()).getTime() - 6 * dayMilliseconds)

const recordPclHomepageRequest = async (portalServerId: string) => {
	const day = shanghaiDayStart(new Date())
	await prisma.pclHomepageRequestDay.deleteMany({
		where: { day: { lt: retainedPclRequestDay() } },
	})
	return prisma.pclHomepageRequestDay.upsert({
		where: { portalServerId_day: { portalServerId, day } },
		create: { portalServerId, day, requestCount: 1 },
		update: { requestCount: { increment: 1 } },
		select: { requestCount: true },
	})
}

const resolvePortalServer = async (identifier: string) => {
	const normalized = normalizeIdentifier(identifier)
	if (!normalized) throw createApiError(400, 'PCL_HOMEPAGE_SERVER_REQUIRED')
	const server = (await listPortalServers()).find((item) =>
		[item.id, item.serverId, item.code, item.shortCode].some(
			(value) => normalizeIdentifier(value) === normalized,
		),
	)
	if (!server) throw createApiError(404, 'PCL_HOMEPAGE_SERVER_NOT_FOUND')
	return server
}

export const listPclHomepageServers = async (): Promise<
	PclHomepageServer[]
> => {
	const [servers, homepages, requestCounts] = await Promise.all([
		listPortalServers(),
		prisma.pclHomepage.findMany({ select: { portalServerId: true } }),
		prisma.pclHomepageRequestDay.groupBy({
			by: ['portalServerId'],
			where: { day: { gte: retainedPclRequestDay() } },
			_sum: { requestCount: true },
		}),
	])
	const configured = new Set(
		homepages.map((homepage) => homepage.portalServerId),
	)
	const requestCountByServer = new Map(
		requestCounts.map((item) => [
			item.portalServerId,
			item._sum.requestCount ?? 0,
		]),
	)
	return servers.map((server) => ({
		...server,
		configured: configured.has(server.id),
		requestCount: requestCountByServer.get(server.id) ?? 0,
	}))
}

export const getPclHomepageEditor = async (identifier: string) => {
	const server = await resolvePortalServer(identifier)
	const homepage = await prisma.pclHomepage.findUnique({
		where: { portalServerId: server.id },
	})
	return { server, xaml: homepage?.xaml ?? '' }
}

export const savePclHomepage = async (
	identifier: string,
	input: PclHomepageInput,
	actorId: string,
) => {
	const server = await resolvePortalServer(identifier)
	return prisma.$transaction(async (tx) => {
		const homepage = await tx.pclHomepage.upsert({
			where: { portalServerId: server.id },
			create: {
				portalServerId: server.id,
				xaml: input.xaml,
				createdById: actorId,
				updatedById: actorId,
			},
			update: { xaml: input.xaml, updatedById: actorId },
		})
		await enqueuePostCommitEvent(tx, 'audit.log', {
			action: 'UPDATED',
			resource: 'pcl-homepage',
			resourceId: homepage.id,
			actorId,
			payload: { portalServerId: server.id },
		})
		return homepage
	})
}

const latestClientPublisher = (manifest: unknown) => {
	if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest))
		return ''
	const publisher = (manifest as Record<string, unknown>).publisher
	if (!publisher || typeof publisher !== 'object' || Array.isArray(publisher))
		return ''
	const person = publisher as Record<string, unknown>
	return typeof person.displayName === 'string'
		? person.displayName
		: typeof person.username === 'string'
			? person.username
			: ''
}

const formatPclDate = (date: Date) => {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone: 'Asia/Shanghai',
		year: 'numeric',
		month: 'numeric',
		day: 'numeric',
	}).formatToParts(date)
	const value = (type: Intl.DateTimeFormatPartTypes) =>
		parts.find((part) => part.type === type)?.value ?? ''
	return `${value('year')}/${value('month')}/${value('day')}`
}

const getLatestClientRelease = async (server: PortalServer) => {
	const aliases = new Set(
		[server.id, server.serverId, server.code, server.shortCode].map(
			normalizeIdentifier,
		),
	)
	const releases = await prisma.clientRelease.findMany({
		where: { status: 'PUBLISHED' },
		select: { version: true, manifest: true, publishedAt: true },
		orderBy: { publishedAt: 'desc' },
	})
	const release = releases.find((item) => {
		const manifest = item.manifest as Record<string, unknown>
		return (
			typeof manifest.clientId === 'string' &&
			aliases.has(normalizeIdentifier(manifest.clientId))
		)
	})
	return {
		version: release?.version ?? '',
		publishedAt: release?.publishedAt ? formatPclDate(release.publishedAt) : '',
		publisher: latestClientPublisher(release?.manifest),
	}
}

const resolveVariables = async (
	server: PortalServer,
	todayRequestCount: number,
): Promise<PclTemplateVariables> => {
	const [overview, latestClient] = await Promise.all([
		fetchPortalJson<PortalLiveOverviewResponse>(
			'/api/public/server/overview-live',
		),
		getLatestClientRelease(server),
	])
	const live = overview.servers.find(
		(item) => item.serverId === server.serverId,
	)
	return {
		serverStatus: live
			? live.bridgeStatus.connected
				? 'ONLINE'
				: 'OFFLINE'
			: server.status,
		onlinePlayers: String(live?.bridgeStatus.onlineCount ?? 0),
		latestClientVersion: latestClient.version,
		latestClientPublishedAt: latestClient.publishedAt,
		latestClientPublisher: latestClient.publisher,
		currentDate: formatPclDate(new Date()),
		todayRequestCount: String(todayRequestCount),
	}
}

const renderXaml = (xaml: string, variables: PclTemplateVariables) => {
	const values = {
		server_status: variables.serverStatus,
		online_players: variables.onlinePlayers,
		latest_client_version: variables.latestClientVersion,
		latest_client_published_at: variables.latestClientPublishedAt,
		latest_client_publisher: variables.latestClientPublisher,
		current_date: variables.currentDate,
		today_request_count: variables.todayRequestCount,
	}
	return xaml.replace(
		/\{\{\s*(server_status|online_players|latest_client_version|latest_client_published_at|latest_client_publisher|current_date|today_request_count)\s*\}\}/g,
		(_match, variable: keyof typeof values) => values[variable],
	)
}

export const renderPclHomepage = async (identifier: string) => {
	const server = await resolvePortalServer(identifier)
	const homepage = await prisma.pclHomepage.findUnique({
		where: { portalServerId: server.id },
	})
	if (!homepage) throw createApiError(404, 'PCL_HOMEPAGE_NOT_CONFIGURED')
	let todayRequestCount = 0
	try {
		todayRequestCount = (await recordPclHomepageRequest(server.id)).requestCount
	} catch (error) {
		console.warn('PCL_HOMEPAGE_REQUEST_STATS_FAILED', {
			portalServerId: server.id,
			error,
		})
	}
	return renderXaml(
		homepage.xaml,
		await resolveVariables(server, todayRequestCount),
	)
}
