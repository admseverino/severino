import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { extractVerificationCode, looksLikeVerificationCodeMessage } from '@severino/phone'

import { DrizzlePhoneVerificationProcessor } from '../adapters/drizzle-phone-verification-processor.js'

describe('DrizzlePhoneVerificationProcessor', () => {
  it('ignores messages without a verification code shape', () => {
    assert.equal(looksLikeVerificationCodeMessage('sem codigo aqui'), false)
    assert.equal(extractVerificationCode('123456'), '123456')
  })

  it('ignores messages without a verification code', async () => {
    const processor = new DrizzlePhoneVerificationProcessor()
    const verified = await processor.processInboundMessages([
      { fromMsisdn: '5511987654321', textBody: 'sem codigo aqui' },
    ])

    assert.equal(verified, 0)
  })
})
