import { log } from '../observability/log.js'
import type {
  InboundHandlerResult,
  InboundMessageHandler,
  StoredInboundMessage,
} from '../ports/inbound-message-handler.js'

export async function runInboundHandlers(
  handlers: InboundMessageHandler[],
  messages: StoredInboundMessage[]
): Promise<Record<string, InboundHandlerResult>> {
  const results: Record<string, InboundHandlerResult> = {}

  for (const handler of handlers) {
    const eligible = messages.filter((message) => handler.acceptsPhoneNumberId(message.phoneNumberId))
    if (eligible.length === 0) {
      continue
    }

    const result = await handler.handleMessages(eligible)
    results[handler.name] = result
    log.info('inbound handler processed messages', {
      handler: handler.name,
      messageCount: eligible.length,
      verified: result.verified ?? null,
      linked: result.linked ?? null,
    })
  }

  return results
}
