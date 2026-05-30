import { randomInt } from 'node:crypto'

import bcrypt from 'bcryptjs'
import { and, eq, isNotNull, ne } from 'drizzle-orm'
import { codeDigest, tryCompletePhoneVerificationForUser, db, schema } from '@severino/db'
import {
  buildWhatsAppVerificationUrl,
  isValidE164,
  normalizeToE164,
  parseWhatsAppSendConfigFromEnv,
  sendWhatsAppText,
  WhatsAppSendError,
} from '@severino/phone'

const { users, phoneVerificationTokens } = schema

const CODE_TTL_MS = 10 * 60 * 1000
const BCRYPT_ROUNDS = 10
const DEFAULT_WHATSAPP_VERIFICATION_PHONE = '+5551995969303'
export class PhoneVerificationError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
    this.name = 'PhoneVerificationError'
  }
}

function generateVerificationCode(): string {
  return String(randomInt(100_000, 1_000_000))
}

async function ensurePhoneIsAvailableForUser(userId: string, phoneE164: string): Promise<void> {
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

  if (existingOwner) {
    throw new PhoneVerificationError('Este telefone já está vinculado a outra conta', 409)
  }
}

async function createVerificationChallenge(
  userId: string,
  phoneE164: string | null
): Promise<{ verificationCode: string; requestedAt: Date }> {
  let verificationCode = generateVerificationCode()
  let digest = codeDigest(verificationCode)

  for (let i = 0; i < 5; i += 1) {
    const [collision] = await db()
      .select({ id: phoneVerificationTokens.id })
      .from(phoneVerificationTokens)
      .where(eq(phoneVerificationTokens.codeDigest, digest))
      .limit(1)
    if (!collision) {
      break
    }
    verificationCode = generateVerificationCode()
    digest = codeDigest(verificationCode)
  }

  const tokenHash = await bcrypt.hash(verificationCode, BCRYPT_ROUNDS)
  const expires = new Date(Date.now() + CODE_TTL_MS)

  await db().delete(phoneVerificationTokens).where(eq(phoneVerificationTokens.userId, userId))

  const [challenge] = await db()
    .insert(phoneVerificationTokens)
    .values({
      userId,
      phoneE164,
      codeDigest: digest,
      tokenHash,
      expires,
    })
    .returning({ createdAt: phoneVerificationTokens.createdAt })

  return { verificationCode, requestedAt: challenge?.createdAt ?? new Date() }
}

async function sendCodeByWhatsAppTemplate(phoneE164: string, verificationCode: string): Promise<void> {
  const config = parseWhatsAppSendConfigFromEnv()
  if (!config) {
    throw new PhoneVerificationError(
      'Envio automático não está configurado. Defina WHATSAPP_ACCESS_TOKEN e WHATSAPP_PHONE_NUMBER_ID.',
      503
    )
  }

  try {
    await sendWhatsAppText({
      config,
      toE164: phoneE164,
      body: `Seu código de verificação Severino é ${verificationCode}.`,
    })
  } catch (error) {
    if (error instanceof WhatsAppSendError) {
      throw new PhoneVerificationError(
        `Não foi possível enviar o código para seu número (${error.status ?? 502}). ${error.responseBody ?? error.message}`,
        error.status ?? 502
      )
    }
    throw error
  }
}

export function getWhatsAppVerificationPhoneE164(): string {
  const configured = process.env.WHATSAPP_VERIFICATION_PHONE_E164?.trim()
  if (configured) {
    const normalized = normalizeToE164(configured)
    if (normalized && isValidE164(normalized)) {
      return normalized
    }
  }
  return DEFAULT_WHATSAPP_VERIFICATION_PHONE
}

export async function requestPhoneVerification(
  userId: string
): Promise<{ verificationCode: string; whatsappUrl: string; requestedAt: Date }> {
  const challenge = await createVerificationChallenge(userId, null)

  const whatsappUrl =
    buildWhatsAppVerificationUrl(getWhatsAppVerificationPhoneE164(), challenge.verificationCode) ??
    buildWhatsAppVerificationUrl(DEFAULT_WHATSAPP_VERIFICATION_PHONE, challenge.verificationCode)!

  return {
    verificationCode: challenge.verificationCode,
    whatsappUrl,
    requestedAt: challenge.requestedAt,
  }
}

export async function requestPhoneVerificationByDirectMessage(
  userId: string,
  phoneInput: string
): Promise<{ phoneE164: string; requestedAt: Date }> {
  const phoneE164 = normalizeToE164(phoneInput)
  if (!phoneE164 || !isValidE164(phoneE164)) {
    throw new PhoneVerificationError('Número de telefone inválido', 400)
  }

  await ensurePhoneIsAvailableForUser(userId, phoneE164)

  const challenge = await createVerificationChallenge(userId, phoneE164)
  await sendCodeByWhatsAppTemplate(phoneE164, challenge.verificationCode)

  return { phoneE164, requestedAt: challenge.requestedAt }
}

export async function verifyPhoneCode(
  userId: string,
  phoneInput: string | null,
  code: string
): Promise<{ phoneE164: string; phoneVerifiedAt: Date }> {
  const phoneE164 = phoneInput ? normalizeToE164(phoneInput) : null
  if (phoneInput && (!phoneE164 || !isValidE164(phoneE164))) {
    throw new PhoneVerificationError('Número de telefone inválido', 400)
  }

  const result = await tryCompletePhoneVerificationForUser(userId, phoneE164, code)
  if (!result) {
    const [challenge] = await db()
      .select({ id: phoneVerificationTokens.id })
      .from(phoneVerificationTokens)
      .where(eq(phoneVerificationTokens.userId, userId))
      .limit(1)

    if (!challenge) {
      throw new PhoneVerificationError('Código expirado ou não encontrado. Solicite um novo.', 400)
    }

    throw new PhoneVerificationError('Código incorreto', 400)
  }

  return {
    phoneE164: result.phoneE164,
    phoneVerifiedAt: result.phoneVerifiedAt,
  }
}

export async function getVerifiedPhone(userId: string): Promise<{
  phoneE164: string | null
  phoneVerifiedAt: Date | null
}> {
  const [row] = await db()
    .select({
      phoneE164: users.phoneE164,
      phoneVerifiedAt: users.phoneVerifiedAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  return {
    phoneE164: row?.phoneE164 ?? null,
    phoneVerifiedAt: row?.phoneVerifiedAt ?? null,
  }
}

export async function removeVerifiedPhone(userId: string): Promise<void> {
  const verified = await getVerifiedPhone(userId)
  if (!verified.phoneE164 || !verified.phoneVerifiedAt) {
    throw new PhoneVerificationError('Nenhum telefone verificado para remover.', 404)
  }

  await db()
    .update(users)
    .set({
      phoneE164: null,
      phoneVerifiedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))

  await db().delete(phoneVerificationTokens).where(eq(phoneVerificationTokens.userId, userId))
}
