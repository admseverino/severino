import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { isValidE164, msisdnToE164, normalizeToE164 } from './normalize.js'

describe('normalizeToE164', () => {
  it('normalizes Brazilian mobile with country code', () => {
    assert.equal(normalizeToE164('+55 11 98765-4321'), '+5511987654321')
  })

  it('adds Brazil country code for local numbers', () => {
    assert.equal(normalizeToE164('11987654321'), '+5511987654321')
    assert.equal(normalizeToE164('1134567890'), '+551134567890')
  })

  it('normalizes WhatsApp MSISDN without plus', () => {
    assert.equal(msisdnToE164('5511987654321'), '+5511987654321')
  })

  it('rejects invalid input', () => {
    assert.equal(normalizeToE164(''), null)
    assert.equal(normalizeToE164('abc'), null)
    assert.equal(normalizeToE164('123'), null)
  })
})

describe('isValidE164', () => {
  it('accepts canonical E.164', () => {
    assert.equal(isValidE164('+5511987654321'), true)
  })

  it('rejects missing plus', () => {
    assert.equal(isValidE164('5511987654321'), false)
  })
})
