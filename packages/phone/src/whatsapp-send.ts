export const DEFAULT_META_GRAPH_VERSION = 'v23.0'

export interface WhatsAppSendConfig {
  accessToken: string
  phoneNumberId: string
  graphApiVersion?: string
}

export interface SendWhatsAppTextParams {
  config: WhatsAppSendConfig
  toE164: string
  body: string
  /** Optional inbound wamid for threaded replies */
  replyToMessageId?: string
}

export class WhatsAppSendError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly responseBody?: string
  ) {
    super(message)
    this.name = 'WhatsAppSendError'
  }
}

export function parseWhatsAppSendConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env
): WhatsAppSendConfig | null {
  const accessToken = env.WHATSAPP_ACCESS_TOKEN?.trim()
  const phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID?.trim()
  if (!accessToken || !phoneNumberId) {
    return null
  }
  return { accessToken, phoneNumberId }
}

export async function sendWhatsAppText(params: SendWhatsAppTextParams): Promise<void> {
  const { config, toE164, body, replyToMessageId } = params
  const version = config.graphApiVersion ?? DEFAULT_META_GRAPH_VERSION

  const payload: Record<string, unknown> = {
    messaging_product: 'whatsapp',
    to: toE164.replace('+', ''),
    type: 'text',
    text: { body },
  }

  if (replyToMessageId) {
    payload.context = { message_id: replyToMessageId }
  }

  const response = await fetch(
    `https://graph.facebook.com/${version}/${config.phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${config.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new WhatsAppSendError(
      `WhatsApp send failed (${response.status})`,
      response.status,
      errorText
    )
  }
}
