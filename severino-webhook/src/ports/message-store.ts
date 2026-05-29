import type { NormalizedWhatsAppMessage } from '../whatsapp/types.js'

export interface MessageStore {
  upsertMessages(messages: NormalizedWhatsAppMessage[]): Promise<number>
}
