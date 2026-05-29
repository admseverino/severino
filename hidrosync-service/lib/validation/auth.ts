import { z } from 'zod'

/** Treat blank / whitespace-only as missing; trim so `.env` trailing spaces do not break email. */
function normalizeAuthField(value: unknown): unknown {
  if (value === null || value === undefined) {
    return undefined
  }
  if (typeof value !== 'string') {
    return value
  }
  const trimmed = value.trim()
  return trimmed === '' ? undefined : trimmed
}

export const loginSchema = z.object({
  email: z.preprocess(
    normalizeAuthField,
    z.string({ required_error: 'Informe o e-mail' }).email('E-mail inválido')
  ),
  password: z.preprocess(
    normalizeAuthField,
    z.string({ required_error: 'Informe a senha' }).min(1, 'Informe a senha')
  ),
})

export type LoginInput = z.infer<typeof loginSchema>

const registerPassword = z
  .string({ required_error: 'Informe a senha' })
  .min(8, 'A senha deve ter pelo menos 8 caracteres')

export const registerSchema = z
  .object({
    name: z.preprocess(
      (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
      z
        .string({ required_error: 'Informe o nome' })
        .min(1, 'Informe o nome')
        .max(120, 'Nome muito longo')
    ),
    email: z.preprocess(
      normalizeAuthField,
      z.string({ required_error: 'Informe o e-mail' }).email('E-mail inválido')
    ),
    password: z.preprocess(normalizeAuthField, registerPassword),
    confirmPassword: z.preprocess(
      normalizeAuthField,
      z.string({ required_error: 'Confirme a senha' })
    ),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmPassword'],
  })

export type RegisterInput = z.infer<typeof registerSchema>
