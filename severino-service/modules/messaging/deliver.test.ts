import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  buildMeterReadingConfirmMessage,
  deliverMeterReadingConfirmIntent,
  type WhatsAppTextSender,
} from './deliver.js'

describe('buildMeterReadingConfirmMessage', () => {
  it('includes suggested value and reading url', () => {
    const message = buildMeterReadingConfirmMessage({
      kind: 'meter_reading_confirm',
      operatorUserId: 'user-1',
      operatorPhoneE164: '+5511987654321',
      meterId: 'meter-1',
      meterLabel: '101A',
      suggestedValue: 1234.5,
      readingUrl: 'https://severi.no/reading/meter-1',
    })

    assert.match(message, /Leitura sugerida: 1234\.5/)
    assert.match(message, /101A/)
    assert.match(message, /https:\/\/severi\.no\/reading\/meter-1/)
  })
})

describe('deliverMeterReadingConfirmIntent', () => {
  it('sends whatsapp when sender and phone are available', async () => {
    const sent: Array<{ toE164: string; body: string }> = []
    const sender: WhatsAppTextSender = {
      async sendText(toE164, body) {
        sent.push({ toE164, body })
      },
    }

    const result = await deliverMeterReadingConfirmIntent(
      {
        kind: 'meter_reading_confirm',
        operatorUserId: 'user-1',
        operatorPhoneE164: '+5511987654321',
        meterId: 'meter-1',
        meterLabel: '101A',
        suggestedValue: 42,
        readingUrl: 'https://severi.no/reading/meter-1',
      },
      sender
    )

    assert.equal(result.whatsappSent, true)
    assert.deepEqual(result.channelsAttempted, ['whatsapp'])
    assert.equal(sent.length, 1)
    assert.equal(sent[0]?.toE164, '+5511987654321')
  })

  it('falls back to in_app when whatsapp sender is unavailable', async () => {
    const result = await deliverMeterReadingConfirmIntent(
      {
        kind: 'meter_reading_confirm',
        operatorUserId: 'user-1',
        operatorPhoneE164: '+5511987654321',
        meterId: 'meter-1',
        meterLabel: '101A',
        suggestedValue: null,
        readingUrl: 'https://severi.no/reading/meter-1',
      },
      null
    )

    assert.equal(result.whatsappSent, false)
    assert.deepEqual(result.channelsAttempted, ['in_app'])
  })
})
