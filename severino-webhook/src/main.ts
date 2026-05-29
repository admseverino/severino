import { env, isIngestEnv, isWorkerEnv } from './config/env.js'
import { startIngestServer } from './ingest/server.js'
import { startWorkerServer } from './worker/server.js'

if (isWorkerEnv(env)) {
  startWorkerServer(env)
} else if (isIngestEnv(env)) {
  startIngestServer(env)
} else {
  throw new Error(`Unknown SERVICE_ROLE: ${(env as { SERVICE_ROLE: string }).SERVICE_ROLE}`)
}
