import type { NormalizedWhatsAppMessage, Msisdn, Wamid } from '../whatsapp/types.js'

export interface StoredWhatsAppMessage {
  id: string
  wamid: Wamid
  fromMsisdn: Msisdn
  textBody: string | null
  waTimestamp: Date
}

export interface MessageStore {
  upsertMessages(messages: NormalizedWhatsAppMessage[]): Promise<StoredWhatsAppMessage[]>
}
