import { OAuth2Client } from 'google-auth-library'
import type { WorkerEnv } from '../config/env.js'
import { log } from '../observability/log.js'

const oauthClient = new OAuth2Client()

export async function verifyPubSubOidc(
  authorizationHeader: string | undefined,
  audience: string | undefined
): Promise<boolean> {
  if (!audience) {
    if (process.env.NODE_ENV === 'production') {
      log.warn('PUBSUB_PUSH_AUDIENCE not set in production; rejecting push')
      return false
    }
    return true
  }

  if (!authorizationHeader?.startsWith('Bearer ')) {
    return false
  }

  const token = authorizationHeader.slice('Bearer '.length)

  try {
    const ticket = await oauthClient.verifyIdToken({ idToken: token, audience })
    const payload = ticket.getPayload()
    return Boolean(payload?.email_verified ?? payload?.sub)
  } catch (error) {
    log.warn('pubsub oidc verification failed', {
      error: error instanceof Error ? error.message : String(error),
    })
    return false
  }
}

export type { WorkerEnv }
