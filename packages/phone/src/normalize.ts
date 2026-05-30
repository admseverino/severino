const E164_PATTERN = /^\+[1-9]\d{6,14}$/

export function digitsOnly(input: string): string {
  return input.replace(/\D/g, '')
}

/**
 * Normalize user input or WhatsApp MSISDN to canonical E.164 (+country + national number).
 * Defaults to Brazil (55) when no country code is present.
 */
export function normalizeToE164(input: string, defaultCountry: 'BR' = 'BR'): string | null {
  const trimmed = input.trim()
  if (!trimmed) {
    return null
  }

  let digits = digitsOnly(trimmed)
  if (!digits) {
    return null
  }

  if (digits.startsWith('0')) {
    digits = digits.replace(/^0+/, '')
  }

  if (defaultCountry === 'BR') {
    if (digits.startsWith('55') && digits.length >= 12 && digits.length <= 13) {
      return `+${digits}`
    }

    if (digits.length === 10 || digits.length === 11) {
      return `+55${digits}`
    }
  }

  if (digits.length >= 10 && digits.length <= 15) {
    return `+${digits}`
  }

  return null
}

/** WhatsApp sends MSISDN without leading + (e.g. 5551987654321). */
export function msisdnToE164(msisdn: string): string | null {
  return normalizeToE164(msisdn, 'BR')
}

export function isValidE164(e164: string): boolean {
  return E164_PATTERN.test(e164)
}

/** Display format for UI (keeps E.164 digits, no spaces). */
export function formatE164ForDisplay(e164: string): string {
  return e164
}
