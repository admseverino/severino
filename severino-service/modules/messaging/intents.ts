export type MessagingChannel = 'whatsapp' | 'in_app'

/** App-level intent: prompt operator to confirm an AI-suggested meter reading after reconnect. */
export interface MeterReadingConfirmIntent {
  kind: 'meter_reading_confirm'
  operatorUserId: string
  operatorPhoneE164: string | null
  meterId: string
  meterLabel: string
  suggestedValue: number | null
  readingUrl: string
}

export type MessagingIntent = MeterReadingConfirmIntent
