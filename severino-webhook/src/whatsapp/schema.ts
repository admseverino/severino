import { z } from 'zod'

export const WhatsAppMessageSchema = z
  .object({
    id: z.string().min(1),
    from: z.string().min(1),
    timestamp: z.string().min(1),
    type: z.string(),
    text: z.object({ body: z.string() }).optional(),
  })
  .passthrough()

export const WhatsAppValueSchema = z
  .object({
    messaging_product: z.literal('whatsapp').optional(),
    metadata: z.object({
      phone_number_id: z.string(),
      display_phone_number: z.string().optional(),
    }),
    contacts: z
      .array(
        z
          .object({
            wa_id: z.string(),
            profile: z.object({ name: z.string() }).partial().optional(),
          })
          .passthrough()
      )
      .optional(),
    messages: z.array(WhatsAppMessageSchema).optional(),
    statuses: z.array(z.unknown()).optional(),
  })
  .passthrough()

export const WhatsAppWebhookBodySchema = z.object({
  object: z.string(),
  entry: z.array(
    z.object({
      id: z.string(),
      changes: z.array(
        z.object({
          field: z.string(),
          value: WhatsAppValueSchema,
        })
      ),
    })
  ),
})

export type WhatsAppWebhookBody = z.infer<typeof WhatsAppWebhookBodySchema>
export type WhatsAppMessageWire = z.infer<typeof WhatsAppMessageSchema>
export type WhatsAppValueWire = z.infer<typeof WhatsAppValueSchema>
