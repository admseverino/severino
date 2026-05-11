import { z } from 'zod'

function trimToUndef(v: unknown): unknown {
  if (typeof v !== 'string') return v
  const trimmed = v.trim()
  return trimmed === '' ? undefined : trimmed
}

export const previewSchema = z.object({
  sessionId: z.preprocess(trimToUndef, z.string().min(1).optional()),
  condoName: z.preprocess(
    trimToUndef,
    z
      .string({ required_error: 'Informe o nome do condomínio' })
      .min(2, 'Nome muito curto')
      .max(160, 'Nome muito longo')
  ),
  condoSlug: z.preprocess(
    trimToUndef,
    z
      .string({ required_error: 'Informe um identificador (slug)' })
      .min(2, 'Identificador muito curto')
      .max(64, 'Identificador muito longo')
  ),
  prompt: z.preprocess(
    trimToUndef,
    z
      .string({ required_error: 'Descreva a estrutura do condomínio' })
      .min(8, 'Descreva a estrutura com mais detalhes')
      .max(4000, 'Texto muito longo')
  ),
  logoImage: z.preprocess(trimToUndef, z.string().url().max(2048).optional()),
})

export type PreviewInputBody = z.infer<typeof previewSchema>

export const commitSchema = z.object({
  sessionId: z.preprocess(
    trimToUndef,
    z.string({ required_error: 'Sessão obrigatória' }).min(1)
  ),
})

export type CommitInputBody = z.infer<typeof commitSchema>
