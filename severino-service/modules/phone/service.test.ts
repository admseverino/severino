import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { isValidE164, normalizeToE164 } from '@severino/phone'

describe('phone verification input', () => {
  it('accepts Brazilian numbers for verification flow', () => {
    const phoneE164 = normalizeToE164('11987654321')
    assert.ok(phoneE164)
    assert.equal(isValidE164(phoneE164), true)
  })

  it('rejects too-short numbers', () => {
    assert.equal(normalizeToE164('123'), null)
  })
})
