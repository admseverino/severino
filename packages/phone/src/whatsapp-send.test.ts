import assert from 'node:assert/strict'
import { afterEach, describe, it, mock } from 'node:test'

import {
  parseWhatsAppSendConfigFromEnv,
  sendWhatsAppText,
  WhatsAppSendError,
} from './whatsapp-send.js'

describe('parseWhatsAppSendConfigFromEnv', () => {
  it('returns config when both env vars are set', () => {
    const config = parseWhatsAppSendConfigFromEnv({
      WHATSAPP_ACCESS_TOKEN: ' token ',
      WHATSAPP_PHONE_NUMBER_ID: ' 123 ',
    })
    assert.deepEqual(config, { accessToken: 'token', phoneNumberId: '123' })
  })

  it('returns null when either env var is missing', () => {
    assert.equal(parseWhatsAppSendConfigFromEnv({ WHATSAPP_ACCESS_TOKEN: 'x' }), null)
    assert.equal(parseWhatsAppSendConfigFromEnv({ WHATSAPP_PHONE_NUMBER_ID: 'x' }), null)
  })
})

describe('sendWhatsAppText', () => {
  afterEach(() => {
    mock.restoreAll()
  })

  it('posts a text message to the Graph API', async () => {
    const fetchMock = mock.fn(async (_url: string, init?: RequestInit) => {
      assert.equal(init?.method, 'POST')
      const headers = init?.headers as Record<string, string>
      assert.equal(headers.authorization, 'Bearer test-token')
      assert.deepEqual(JSON.parse(String(init?.body)), {
        messaging_product: 'whatsapp',
        to: '5511987654321',
        type: 'text',
        text: { body: 'hello' },
      })
      return new Response('', { status: 200 })
    })
    mock.method(globalThis, 'fetch', fetchMock)

    await sendWhatsAppText({
      config: { accessToken: 'test-token', phoneNumberId: 'phone-id' },
      toE164: '+5511987654321',
      body: 'hello',
    })

    assert.equal(fetchMock.mock.calls.length, 1)
    assert.match(String(fetchMock.mock.calls[0].arguments[0]), /\/phone-id\/messages$/)
  })

  it('includes reply context when replyToMessageId is set', async () => {
    const fetchMock = mock.fn(async (_url: string, init?: RequestInit) => {
      assert.deepEqual(JSON.parse(String(init?.body)), {
        messaging_product: 'whatsapp',
        to: '5511987654321',
        type: 'text',
        text: { body: 'reply' },
        context: { message_id: 'wamid.abc' },
      })
      return new Response('', { status: 200 })
    })
    mock.method(globalThis, 'fetch', fetchMock)

    await sendWhatsAppText({
      config: { accessToken: 'test-token', phoneNumberId: 'phone-id' },
      toE164: '+5511987654321',
      body: 'reply',
      replyToMessageId: 'wamid.abc',
    })
  })

  it('throws WhatsAppSendError on non-2xx responses', async () => {
    mock.method(
      globalThis,
      'fetch',
      mock.fn(async () => new Response('bad request', { status: 400 }))
    )

    await assert.rejects(
      () =>
        sendWhatsAppText({
          config: { accessToken: 'test-token', phoneNumberId: 'phone-id' },
          toE164: '+5511987654321',
          body: 'hello',
        }),
      (error: unknown) => {
        assert.ok(error instanceof WhatsAppSendError)
        assert.equal(error.status, 400)
        assert.equal(error.responseBody, 'bad request')
        return true
      }
    )
  })
})
