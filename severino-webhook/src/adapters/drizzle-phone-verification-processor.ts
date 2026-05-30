import { tryCompletePhoneVerificationByInbound } from '@severino/db'
import { extractVerificationCode, msisdnToE164 } from '@severino/phone'

import type {
  InboundVerificationMessage,
  PhoneVerificationProcessor,
} from '../ports/phone-verification-processor.js'
import { log } from '../observability/log.js'

export class DrizzlePhoneVerificationProcessor implements PhoneVerificationProcessor {
  async processInboundMessages(messages: InboundVerificationMessage[]): Promise<number> {
    let verified = 0

    for (const message of messages) {
      const code = extractVerificationCode(message.textBody)
      if (!code) {
        continue
      }

      const senderPhoneE164 = msisdnToE164(message.fromMsisdn)
      if (!senderPhoneE164) {
        continue
      }

      const result = await tryCompletePhoneVerificationByInbound(senderPhoneE164, code)
      if (!result) {
        continue
      }

      verified += 1
      log.info('phone verified via inbound whatsapp', {
        userId: result.userId,
        phoneE164: result.phoneE164,
      })
    }

    return verified
  }
}
