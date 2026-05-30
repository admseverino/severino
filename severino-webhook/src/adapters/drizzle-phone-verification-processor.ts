import { hasActivePhoneVerificationChallenges, tryCompletePhoneVerificationByInbound } from '@severino/db'
import {
  extractVerificationCode,
  looksLikeVerificationCodeMessage,
  msisdnToE164,
} from '@severino/phone'

import type {
  InboundVerificationMessage,
  PhoneVerificationProcessor,
} from '../ports/phone-verification-processor.js'
import { log } from '../observability/log.js'

export class DrizzlePhoneVerificationProcessor implements PhoneVerificationProcessor {
  async processInboundMessages(messages: InboundVerificationMessage[]): Promise<number> {
    if (messages.length === 0) {
      return 0
    }

    const candidateMessages = messages.filter((message) =>
      looksLikeVerificationCodeMessage(message.textBody)
    )
    if (candidateMessages.length === 0) {
      return 0
    }

    const hasActiveChallenges = await hasActivePhoneVerificationChallenges()
    if (!hasActiveChallenges) {
      return 0
    }

    let verified = 0

    for (const message of candidateMessages) {
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
