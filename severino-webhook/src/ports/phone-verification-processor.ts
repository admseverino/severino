export interface InboundVerificationMessage {
  fromMsisdn: string
  textBody: string | null
}

export interface PhoneVerificationProcessor {
  processInboundMessages(messages: InboundVerificationMessage[]): Promise<number>
}
