import { z } from 'zod'

export const phoneRequestSchema = z.object({
  phone: z.string().min(8, 'Informe um número de telefone válido').optional(),
})

export const phoneVerifySchema = z.object({
  phone: z.string().min(8, 'Informe um número de telefone válido').optional(),
  code: z.string().regex(/^\d{6}$/, 'O código deve ter 6 dígitos'),
})

export const phoneManualSendSchema = z.object({
  phone: z.string().min(8, 'Informe um número de telefone válido'),
})
