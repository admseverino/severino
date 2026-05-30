import { digitsOnly, isValidE164 } from './normalize.js'

/** Extract a 6-digit verification code from inbound WhatsApp text. */
export function extractVerificationCode(text: string | null | undefined): string | null {
  if (!text) {
    return null
  }

  const trimmed = text.trim()
  if (/^\d{6}$/.test(trimmed)) {
    return trimmed
  }

  const match = trimmed.match(/\b(\d{6})\b/)
  return match?.[1] ?? null
}

/** Convert E.164 (+5551995969303) to wa.me digits (5551995969303). */
export function e164ToWhatsAppDigits(e164: string): string | null {
  if (!isValidE164(e164)) {
    return null
  }
  return digitsOnly(e164)
}

/** Build a wa.me deep link with a pre-filled verification message. */
export function buildWhatsAppVerificationUrl(businessPhoneE164: string, code: string): string | null {
  const digits = e164ToWhatsAppDigits(businessPhoneE164)
  if (!digits || !/^\d{6}$/.test(code)) {
    return null
  }

  return `https://wa.me/${digits}?text=${encodeURIComponent(code)}`
}
