import type { PhoneVerificationProcessor } from '../ports/phone-verification-processor.js'
import type {
  InboundHandlerResult,
  InboundMessageHandler,
  StoredInboundMessage,
} from '../ports/inbound-message-handler.js'
import type { UserMessageLinker } from '../ports/user-message-linker.js'

export class SeverinoInboundHandler implements InboundMessageHandler {
  readonly name = 'severino'

  constructor(
    private readonly allowedPhoneNumberIds: ReadonlySet<string>,
    private readonly phoneVerificationProcessor: PhoneVerificationProcessor,
    private readonly userMessageLinker: UserMessageLinker
  ) {}

  acceptsPhoneNumberId(phoneNumberId: string): boolean {
    if (this.allowedPhoneNumberIds.size === 0) {
      return true
    }
    return this.allowedPhoneNumberIds.has(phoneNumberId)
  }

  async handleMessages(messages: StoredInboundMessage[]): Promise<InboundHandlerResult> {
    const eligible = messages.filter((message) => this.acceptsPhoneNumberId(message.phoneNumberId))
    if (eligible.length === 0) {
      return {}
    }

    const verified = await this.phoneVerificationProcessor.processInboundMessages(
      eligible.map((message) => ({
        fromMsisdn: message.fromMsisdn,
        textBody: message.textBody,
      }))
    )

    const linked = await this.userMessageLinker.linkRegisteredUserMessages(
      eligible.map((message) => ({
        whatsappMessageId: message.id,
        fromMsisdn: message.fromMsisdn,
        textBody: message.textBody,
        waTimestamp: message.waTimestamp,
      }))
    )

    return { verified, linked }
  }
}

export function parsePhoneNumberIdList(raw: string | undefined): Set<string> {
  if (!raw?.trim()) {
    return new Set()
  }
  return new Set(
    raw
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
  )
}
