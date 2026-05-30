export interface LinkableWhatsAppMessage {
  whatsappMessageId: string
  fromMsisdn: string
  textBody: string | null
  waTimestamp: Date
}

export interface UserMessageLinker {
  linkRegisteredUserMessages(messages: LinkableWhatsAppMessage[]): Promise<number>
}
