import express from 'express'
import type { WorkerEnv } from '../config/env.js'
import { log } from '../observability/log.js'
import { handlePubSubPushSafe } from './handler.js'
import { verifyPubSubOidc } from './verify-oidc.js'

export function startWorkerServer(env: WorkerEnv): void {
  const app = express()
  app.disable('x-powered-by')
  app.use(express.json({ limit: '1mb' }))

  app.get('/health', (_req, res) => {
    res.status(200).json({ ok: true, role: 'worker' })
  })

  app.post('/pubsub/push', async (req, res) => {
    const authorized = await verifyPubSubOidc(
      req.header('authorization'),
      env.PUBSUB_PUSH_AUDIENCE
    )

    if (!authorized) {
      res.sendStatus(403)
      return
    }

    const result = await handlePubSubPushSafe(req.body)
    if (result.ok) {
      res.sendStatus(200)
      return
    }

    res.sendStatus(500)
  })

  app.listen(env.PORT, () => {
    log.info('worker server listening', { port: env.PORT })
  })
}
