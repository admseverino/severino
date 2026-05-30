import type { MeterReadingConfirmIntent, MessagingChannel } from './intents.js'

export function buildMeterReadingConfirmMessage(intent: MeterReadingConfirmIntent): string {
  const valuePart =
    intent.suggestedValue != null ? `Leitura sugerida: ${intent.suggestedValue}. ` : ''
  return `${valuePart}Confirme a leitura do medidor ${intent.meterLabel}: ${intent.readingUrl}`
}

export interface DeliverMeterReadingConfirmOptions {
  channels?: MessagingChannel[]
}

export interface DeliverMeterReadingConfirmResult {
  whatsappSent: boolean
  channelsAttempted: MessagingChannel[]
}

export interface WhatsAppTextSender {
  sendText(toE164: string, body: string): Promise<void>
}

export async function deliverMeterReadingConfirmIntent(
  intent: MeterReadingConfirmIntent,
  sender: WhatsAppTextSender | null,
  options: DeliverMeterReadingConfirmOptions = {}
): Promise<DeliverMeterReadingConfirmResult> {
  const channels =
    options.channels ??
    (intent.operatorPhoneE164 && sender ? (['whatsapp'] as MessagingChannel[]) : (['in_app'] as MessagingChannel[]))

  let whatsappSent = false

  if (channels.includes('whatsapp') && intent.operatorPhoneE164 && sender) {
    await sender.sendText(intent.operatorPhoneE164, buildMeterReadingConfirmMessage(intent))
    whatsappSent = true
  }

  return { whatsappSent, channelsAttempted: channels }
}
