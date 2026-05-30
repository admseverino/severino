import {
  parseWhatsAppSendConfigFromEnv,
  sendWhatsAppText,
  type WhatsAppSendConfig,
} from '@severino/phone'

import type { WhatsAppTextSender } from './deliver.js'

export function createWhatsAppTextSender(
  config: WhatsAppSendConfig | null = parseWhatsAppSendConfigFromEnv()
): WhatsAppTextSender | null {
  if (!config) {
    return null
  }

  return {
    async sendText(toE164: string, body: string): Promise<void> {
      await sendWhatsAppText({ config, toE164, body })
    },
  }
}
