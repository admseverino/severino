import bcrypt from 'bcryptjs'
import { createHash } from 'node:crypto'
import { and, eq, gt, isNotNull, ne } from 'drizzle-orm'

import { db } from './client.js'
import { phoneVerificationTokens, users } from './schema/auth.js'

export interface PhoneVerificationResult {
  userId: string
  phoneE164: string
  phoneVerifiedAt: Date
}

export function codeDigest(code: string): string {
  return createHash('sha256').update(code.trim()).digest('hex')
}

async function markUserPhoneVerified(
  userId: string,
  phoneE164: string
): Promise<PhoneVerificationResult> {
  const phoneVerifiedAt = new Date()

  await db()
    .update(users)
    .set({
      phoneE164,
      phoneVerifiedAt,
      updatedAt: phoneVerifiedAt,
    })
    .where(eq(users.id, userId))

  await db().delete(phoneVerificationTokens).where(eq(phoneVerificationTokens.userId, userId))

  return { userId, phoneE164, phoneVerifiedAt }
}

async function isPhoneOwnedByAnotherUser(
  phoneE164: string,
  userId: string
): Promise<boolean> {
  const [existingOwner] = await db()
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.phoneE164, phoneE164),
        isNotNull(users.phoneVerifiedAt),
        ne(users.id, userId)
      )
    )
    .limit(1)

  return Boolean(existingOwner)
}

/** Complete verification when a matching code arrives from WhatsApp. */
export async function tryCompletePhoneVerificationByInbound(
  senderPhoneE164: string,
  code: string
): Promise<PhoneVerificationResult | null> {
  const trimmedCode = code.trim()
  if (!/^\d{6}$/.test(trimmedCode)) {
    return null
  }

  const challenges = await db()
    .select()
    .from(phoneVerificationTokens)
    .where(and(eq(phoneVerificationTokens.codeDigest, codeDigest(trimmedCode)), gt(phoneVerificationTokens.expires, new Date())))

  for (const challenge of challenges) {
    const valid = await bcrypt.compare(trimmedCode, challenge.tokenHash)
    if (!valid) {
      continue
    }

    if (await isPhoneOwnedByAnotherUser(senderPhoneE164, challenge.userId)) {
      continue
    }

    return markUserPhoneVerified(challenge.userId, senderPhoneE164)
  }

  return null
}

/** Complete verification for the logged-in user (manual code entry). */
export async function tryCompletePhoneVerificationForUser(
  userId: string,
  phoneE164: string | null,
  code: string
): Promise<PhoneVerificationResult | null> {
  const trimmedCode = code.trim()
  if (!/^\d{6}$/.test(trimmedCode)) {
    return null
  }

  const challenges = await db()
    .select()
    .from(phoneVerificationTokens)
    .where(and(eq(phoneVerificationTokens.userId, userId), gt(phoneVerificationTokens.expires, new Date())))

  for (const challenge of challenges) {
    if (phoneE164 && challenge.phoneE164 && challenge.phoneE164 !== phoneE164) {
      continue
    }

    if (challenge.codeDigest !== codeDigest(trimmedCode)) {
      continue
    }

    const valid = await bcrypt.compare(trimmedCode, challenge.tokenHash)
    if (!valid) {
      continue
    }

    const resolvedPhone = challenge.phoneE164 ?? phoneE164
    if (!resolvedPhone) {
      continue
    }

    if (await isPhoneOwnedByAnotherUser(resolvedPhone, userId)) {
      continue
    }

    return markUserPhoneVerified(userId, resolvedPhone)
  }

  return null
}
