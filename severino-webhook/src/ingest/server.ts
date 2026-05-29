import express, { type Request, type Response, type Router } from 'express'
import { DirectEventPublisher } from '../adapters/direct-publisher.js'
import { DrizzleEventStore } from '../adapters/drizzle-event-store.js'
import { PubSubEventPublisher } from '../adapters/pubsub-publisher.js'
import type { IngestEnv } from '../config/env.js'
import type { EventPublisher } from '../ports/event-publisher.js'
import { log } from '../observability/log.js'
import { safeEqual, verifySignature } from './verify-signature.js'

function createPublisher(env: IngestEnv): EventPublisher {
  if (env.PUBLISHER_MODE === 'direct') {
    if (!env.WORKER_URL) {
      throw new Error('WORKER_URL is required when PUBLISHER_MODE=direct')
    }
    return new DirectEventPublisher(env.WORKER_URL)
  }

  const projectId = env.GCP_PROJECT_ID ?? process.env.GOOGLE_CLOUD_PROJECT
  if (!projectId) {
    throw new Error('GCP_PROJECT_ID or GOOGLE_CLOUD_PROJECT is required for pubsub publisher')
  }

  return new PubSubEventPublisher(projectId, env.PUBSUB_TOPIC)
}

export function createIngestRouter(env: IngestEnv): Router {
  const router = express.Router()
  const eventStore = new DrizzleEventStore()
  const publisher = createPublisher(env)

  router.get('/health', (_req, res) => {
    res.status(200).json({ ok: true, role: 'ingest' })
  })

  router.get('/webhook', (req: Request, res: Response) => {
    const mode = req.query['hub.mode']
    const token = req.query['hub.verify_token']
    const challenge = req.query['hub.challenge']

    if (
      mode === 'subscribe' &&
      typeof token === 'string' &&
      typeof challenge === 'string' &&
      safeEqual(token, env.WHATSAPP_VERIFY_TOKEN)
    ) {
      res.status(200).type('text/plain').send(challenge)
      return
    }

    log.warn('webhook verification failed', { mode: String(mode ?? '') })
    res.sendStatus(403)
  })

  router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const rawBody = req.body as Buffer
    const signature = req.header('x-hub-signature-256')

    if (!Buffer.isBuffer(rawBody) || rawBody.length === 0) {
      res.sendStatus(400)
      return
    }

    if (!verifySignature(rawBody, signature, env.WHATSAPP_APP_SECRET)) {
      log.warn('webhook signature invalid')
      res.sendStatus(401)
      return
    }

    let payload: unknown
    try {
      payload = JSON.parse(rawBody.toString('utf8')) as unknown
    } catch {
      res.sendStatus(400)
      return
    }

    try {
      const eventId = await eventStore.insertRaw({
        signature: signature ?? null,
        payload,
        rawBody: rawBody.toString('utf8'),
      })

      try {
        await publisher.publish(eventId)
      } catch (publishError) {
        log.error('failed to publish event; row persisted for reconciliation', {
          eventId,
          error: publishError instanceof Error ? publishError.message : String(publishError),
        })
      }

      res.sendStatus(200)
    } catch (error) {
      log.error('failed to persist webhook event', {
        error: error instanceof Error ? error.message : String(error),
      })
      res.sendStatus(500)
    }
  })

  return router
}

export function startIngestServer(env: IngestEnv): void {
  const app = express()
  app.disable('x-powered-by')
  app.use(createIngestRouter(env))

  app.listen(env.PORT, () => {
    log.info('ingest server listening', { port: env.PORT })
  })
}
