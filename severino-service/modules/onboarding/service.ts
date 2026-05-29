import { eq } from 'drizzle-orm'

import { db, schema } from '@severino/db'

import { getOnboardingExtractor } from './extractor'
import {
  createDraftSession,
  findDraftSessionForActor,
  loadPreview,
  replaceTempStructure,
  updateDraftSession,
  type OnboardingSessionRow,
  type TempGroupRow,
  type TempMeterRow,
  type TempUnitRow,
} from './repository'
import { assertValidGroupStructure } from './group-tree'
import { commitOnboardingSession, type CommitResult } from './commit'

export interface PreviewInput {
  actorId: string
  sessionId?: string
  condoName: string
  condoSlug: string
  prompt: string
  logoImage?: string | null
}

export interface PreviewResult {
  session: OnboardingSessionRow
  groups: TempGroupRow[]
  units: TempUnitRow[]
  meters: TempMeterRow[]
  warnings: string[]
}

/**
 * Drives the prompt → preview path. Either creates a new draft session (no `sessionId`) or
 * regenerates temp rows for an existing draft. Re-running the prompt fully replaces temp data
 * (workflow §1: "onboarding is idempotent until committed").
 */
export async function previewFromPrompt(input: PreviewInput): Promise<PreviewResult> {
  const trimmedName = input.condoName.trim()
  const slug = normalizeSlug(input.condoSlug)
  if (slug.length < 2) {
    throw new Error('Identificador (slug) inválido')
  }
  if (trimmedName.length < 2) {
    throw new Error('Nome do condomínio inválido')
  }
  await assertSlugAvailableForSession(slug, input.sessionId)

  let session: OnboardingSessionRow
  if (input.sessionId) {
    const existing = await findDraftSessionForActor(input.sessionId, input.actorId)
    if (!existing) {
      throw new Error('Sessão de onboarding não encontrada')
    }
    if (existing.status !== 'draft') {
      throw new Error('Sessão já foi comprometida; inicie uma nova.')
    }
    const updated = await updateDraftSession(existing.id, {
      condoName: trimmedName,
      condoSlug: slug,
      prompt: input.prompt,
      logoImage: input.logoImage ?? null,
    })
    session = updated ?? existing
  } else {
    session = await createDraftSession({
      actorId: input.actorId,
      condoName: trimmedName,
      condoSlug: slug,
      prompt: input.prompt,
      logoImage: input.logoImage ?? null,
    })
  }

  const extractor = getOnboardingExtractor()
  const structure = await extractor.extract(input.prompt)
  assertValidGroupStructure(structure.groups)
  await replaceTempStructure(session.id, structure)
  const preview = await loadPreview(session.id)

  return {
    session,
    ...preview,
    warnings: structure.warnings,
  }
}

export interface CommitInput {
  actorId: string
  sessionId: string
}

export async function commitOnboarding(input: CommitInput): Promise<CommitResult> {
  const session = await findDraftSessionForActor(input.sessionId, input.actorId)
  if (!session) {
    throw new Error('Sessão de onboarding não encontrada')
  }
  return commitOnboardingSession({ actorId: input.actorId, session })
}

export function normalizeSlug(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
}

async function assertSlugAvailableForSession(slug: string, sessionId: string | undefined): Promise<void> {
  const [row] = await db()
    .select({ id: schema.condos.id })
    .from(schema.condos)
    .where(eq(schema.condos.slug, slug))
    .limit(1)
  if (row) {
    throw new Error('Já existe um condomínio com este identificador')
  }
  if (!sessionId) {
    const [other] = await db()
      .select({ id: schema.onboardingSessions.id })
      .from(schema.onboardingSessions)
      .where(eq(schema.onboardingSessions.condoSlug, slug))
      .limit(1)
    if (other) {
      throw new Error('Outra sessão de onboarding já usa este identificador')
    }
  }
}
