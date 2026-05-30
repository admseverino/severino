export interface StoredInboundMessage {
  id: string
  wamid: string
  phoneNumberId: string
  fromMsisdn: string
  textBody: string | null
  waTimestamp: Date
}

export interface InboundHandlerResult {
  verified?: number
  linked?: number
}

export interface InboundMessageHandler {
  readonly name: string
  acceptsPhoneNumberId(phoneNumberId: string): boolean
  handleMessages(messages: StoredInboundMessage[]): Promise<InboundHandlerResult>
}
