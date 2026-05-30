import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { LinkableWhatsAppMessage, UserMessageLinker } from '../ports/user-message-linker.js'
import { msisdnToE164 } from '@severino/phone'

class FakeUserMessageLinker implements UserMessageLinker {
  private readonly userByPhone = new Map<string, string>()
  readonly linked: Array<{ userId: string; message: LinkableWhatsAppMessage }> = []

  registerUser(phoneE164: string, userId: string): void {
    this.userByPhone.set(phoneE164, userId)
  }

  async linkRegisteredUserMessages(messages: LinkableWhatsAppMessage[]): Promise<number> {
    let linked = 0

    for (const message of messages) {
      const phoneE164 = msisdnToE164(message.fromMsisdn)
      if (!phoneE164) {
        continue
      }

      const userId = this.userByPhone.get(phoneE164)
      if (!userId) {
        continue
      }

      this.linked.push({ userId, message })
      linked += 1
    }

    return linked
  }
}

describe('UserMessageLinker', () => {
  it('links messages only for verified registered users', async () => {
    const linker = new FakeUserMessageLinker()
    linker.registerUser('+5511987654321', 'user-1')

    const linked = await linker.linkRegisteredUserMessages([
      {
        whatsappMessageId: 'msg-1',
        fromMsisdn: '5511987654321',
        textBody: 'Olá',
        waTimestamp: new Date('2026-05-30T12:00:00Z'),
      },
      {
        whatsappMessageId: 'msg-2',
        fromMsisdn: '5511999999999',
        textBody: 'Desconhecido',
        waTimestamp: new Date('2026-05-30T12:01:00Z'),
      },
    ])

    assert.equal(linked, 1)
    assert.equal(linker.linked[0]?.userId, 'user-1')
    assert.equal(linker.linked[0]?.message.textBody, 'Olá')
  })
})
