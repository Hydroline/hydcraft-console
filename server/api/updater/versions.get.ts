import { listClientVersions } from '../../utils/client-updates/service'

export default defineEventHandler(async () => listClientVersions())
