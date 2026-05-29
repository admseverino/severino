import { z } from 'zod'

import { PRINT_GROUP_KINDS, type PrintGroupKind } from '@/modules/meters'

export const condoSlugQuerySchema = z
  .string()
  .min(2)
  .max(64)
  .regex(/^[a-z0-9-]+$/i, 'slug deve conter apenas letras, números e hífens')
  .transform((s) => s.toLowerCase())

export const printGroupKindSchema = z.enum(
  PRINT_GROUP_KINDS as unknown as [PrintGroupKind, ...PrintGroupKind[]]
)

export const meterIdSchema = z
  .string()
  .min(8)
  .max(64)
  .regex(/^[A-Za-z0-9-]+$/, 'identificador inválido')

/** Parse `?condo=&groupKind=` for the print page. Both query keys are optional. */
export function parseMetersQuery(input: {
  condo?: string | string[]
  groupKind?: string | string[]
}): {
  condoSlug: string | null
  groupKind: PrintGroupKind
} {
  const rawCondo = Array.isArray(input.condo) ? input.condo[0] : input.condo
  const rawKind = Array.isArray(input.groupKind) ? input.groupKind[0] : input.groupKind

  const condoSlug = (() => {
    if (!rawCondo) return null
    const parsed = condoSlugQuerySchema.safeParse(rawCondo)
    return parsed.success ? parsed.data : null
  })()

  const groupKind: PrintGroupKind = (() => {
    if (!rawKind) return 'none'
    const parsed = printGroupKindSchema.safeParse(rawKind)
    return parsed.success ? parsed.data : 'none'
  })()

  return { condoSlug, groupKind }
}
