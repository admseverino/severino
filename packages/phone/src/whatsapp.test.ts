import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  buildWhatsAppVerificationUrl,
  extractVerificationCode,
  looksLikeVerificationCodeMessage,
} from './whatsapp.js'

describe('looksLikeVerificationCodeMessage', () => {
  it('matches plain and embedded 6-digit codes', () => {
    assert.equal(looksLikeVerificationCodeMessage('123456'), true)
    assert.equal(looksLikeVerificationCodeMessage('Verificar 654321 agora'), true)
  })

  it('rejects messages without a 6-digit token', () => {
    assert.equal(looksLikeVerificationCodeMessage('sem codigo aqui'), false)
    assert.equal(looksLikeVerificationCodeMessage('12345'), false)
    assert.equal(looksLikeVerificationCodeMessage(null), false)
  })
})

describe('extractVerificationCode', () => {
  it('accepts a plain 6-digit message', () => {
    assert.equal(extractVerificationCode('123456'), '123456')
  })

  it('extracts code from surrounding text', () => {
    assert.equal(extractVerificationCode('Verificar 654321 agora'), '654321')
  })

  it('rejects invalid messages', () => {
    assert.equal(extractVerificationCode('hello'), null)
    assert.equal(extractVerificationCode(null), null)
  })
})

describe('buildWhatsAppVerificationUrl', () => {
  it('builds wa.me link with encoded code', () => {
    assert.equal(
      buildWhatsAppVerificationUrl('+5551995969303', '123456'),
      'https://wa.me/5551995969303?text=123456'
    )
  })
})
