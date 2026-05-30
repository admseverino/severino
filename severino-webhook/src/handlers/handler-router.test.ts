import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { InboundHandlerResult, InboundMessageHandler, StoredInboundMessage } from '../ports/inbound-message-handler.js'
import { runInboundHandlers } from './handler-router.js'
import { parsePhoneNumberIdList, SeverinoInboundHandler } from './severino-inbound-handler.js'
import type { PhoneVerificationProcessor } from '../ports/phone-verification-processor.js'
import type { UserMessageLinker } from '../ports/user-message-linker.js'

class FakeHandler implements InboundMessageHandler {
  readonly name: string
  readonly allowedIds: Set<string>
  handled: StoredInboundMessage[] = []

  constructor(name: string, allowedIds: string[]) {
    this.name = name
    this.allowedIds = new Set(allowedIds)
  }

  acceptsPhoneNumberId(phoneNumberId: string): boolean {
    return this.allowedIds.has(phoneNumberId)
  }

  async handleMessages(messages: StoredInboundMessage[]): Promise<InboundHandlerResult> {
    this.handled.push(...messages)
    return { verified: messages.length }
  }
}

describe('parsePhoneNumberIdList', () => {
  it('parses comma-separated ids', () => {
    assert.deepEqual(parsePhoneNumberIdList(' id1 , id2 '), new Set(['id1', 'id2']))
  })

  it('returns empty set when unset', () => {
    assert.deepEqual(parsePhoneNumberIdList(undefined), new Set())
  })
})

describe('SeverinoInboundHandler', () => {
  it('accepts all phone number ids when allowlist is empty', () => {
    const handler = new SeverinoInboundHandler(
      new Set(),
      { processInboundMessages: async () => 0 } satisfies PhoneVerificationProcessor,
      { linkRegisteredUserMessages: async () => 0 } satisfies UserMessageLinker
    )

    assert.equal(handler.acceptsPhoneNumberId('any-id'), true)
  })

  it('only accepts configured phone number ids', () => {
    const handler = new SeverinoInboundHandler(
      new Set(['allowed-id']),
      { processInboundMessages: async () => 0 } satisfies PhoneVerificationProcessor,
      { linkRegisteredUserMessages: async () => 0 } satisfies UserMessageLinker
    )

    assert.equal(handler.acceptsPhoneNumberId('allowed-id'), true)
    assert.equal(handler.acceptsPhoneNumberId('other-id'), false)
  })
})

describe('runInboundHandlers', () => {
  it('routes messages only to matching handlers', async () => {
    const severino = new FakeHandler('severino', ['phone-a'])
    const other = new FakeHandler('other-app', ['phone-b'])

    const messages: StoredInboundMessage[] = [
      {
        id: '1',
        wamid: 'wamid.1',
        phoneNumberId: 'phone-a',
        fromMsisdn: '5511987654321',
        textBody: 'hello',
        waTimestamp: new Date('2026-01-01T00:00:00Z'),
      },
      {
        id: '2',
        wamid: 'wamid.2',
        phoneNumberId: 'phone-b',
        fromMsisdn: '5511987654321',
        textBody: 'world',
        waTimestamp: new Date('2026-01-01T00:00:00Z'),
      },
    ]

    await runInboundHandlers([severino, other], messages)

    assert.equal(severino.handled.length, 1)
    assert.equal(severino.handled[0]?.phoneNumberId, 'phone-a')
    assert.equal(other.handled.length, 1)
    assert.equal(other.handled[0]?.phoneNumberId, 'phone-b')
  })
})
