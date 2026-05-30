import type { NormalizedWhatsAppMessage, Msisdn, PhoneNumberId, Wamid } from '../whatsapp/types.js'

export interface StoredWhatsAppMessage {
  id: string
  wamid: Wamid
  phoneNumberId: PhoneNumberId
  fromMsisdn: Msisdn
  textBody: string | null
  waTimestamp: Date
}

export interface MessageStore {
  upsertMessages(messages: NormalizedWhatsAppMessage[]): Promise<StoredWhatsAppMessage[]>
}
