export type Brand<T, B extends string> = T & { readonly __brand: B }

export type EventId = Brand<string, 'EventId'>
export type Wamid = Brand<string, 'Wamid'>
export type PhoneNumberId = Brand<string, 'PhoneNumberId'>
export type Msisdn = Brand<string, 'Msisdn'>

export type WhatsAppMessageType =
  | 'text'
  | 'image'
  | 'audio'
  | 'video'
  | 'document'
  | 'sticker'
  | 'location'
  | 'contacts'
  | 'button'
  | 'interactive'
  | 'reaction'
  | 'order'
  | 'system'
  | 'unknown'

export interface NormalizedWhatsAppMessage {
  eventId: EventId
  wamid: Wamid
  wabaId: string | null
  phoneNumberId: PhoneNumberId
  fromMsisdn: Msisdn
  contactName: string | null
  messageType: WhatsAppMessageType
  textBody: string | null
  payload: Record<string, unknown>
  waTimestamp: Date
}

export function asEventId(id: string): EventId {
  return id as EventId
}

export function asWamid(id: string): Wamid {
  return id as Wamid
}

export function asPhoneNumberId(id: string): PhoneNumberId {
  return id as PhoneNumberId
}

export function asMsisdn(id: string): Msisdn {
  return id as Msisdn
}
