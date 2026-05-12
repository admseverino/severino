'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface PreviewSession {
  id: string
  condoName: string
  condoSlug: string
  prompt: string
  status: 'draft' | 'committed'
  updatedAt: string
}

interface PreviewGroup {
  id: string
  name: string
  kind: string
  sortOrder: number
  parentTempGroupId: string | null
}

interface PreviewUnit {
  id: string
  label: string
  tempGroupId: string | null
  sortOrder: number
}

interface PreviewMeter {
  id: string
  kind: 'submeter' | 'master'
  targetKind: 'unit' | 'group' | 'condo'
  targetTempUnitId: string | null
  targetTempGroupId: string | null
  identifier: string | null
  sortOrder: number
}

interface PreviewPayload {
  session: PreviewSession
  groups: PreviewGroup[]
  units: PreviewUnit[]
  meters: PreviewMeter[]
  warnings: string[]
}

interface FormState {
  condoName: string
  condoSlug: string
  prompt: string
}

interface CommitSuccess {
  condoId: string
  condoSlug: string
  counts: {
    groups: number
    units: number
    submeters: number
    masters: number
  }
}

const SAMPLE_PROMPT =
  'Duas torres, A e B com 10 andares cada, 4 apartamentos por andar (ex. 1001A, 1002A), 1 master por torre e 1 hidrômetro geral do condomínio.'

function autoSlugFromName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
}

export function OnboardingClient(): React.JSX.Element {
  const [form, setForm] = useState<FormState>({
    condoName: '',
    condoSlug: '',
    prompt: '',
  })
  const [slugTouched, setSlugTouched] = useState(false)
  const [draftSessionId, setDraftSessionId] = useState<string | null>(null)
  const [preview, setPreview] = useState<PreviewPayload | null>(null)
  const [committed, setCommitted] = useState<CommitSuccess | null>(null)
  const [submitting, setSubmitting] = useState<'preview' | 'commit' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const effectiveSlug = useMemo(() => {
    if (slugTouched) return form.condoSlug
    return autoSlugFromName(form.condoName)
  }, [form.condoName, form.condoSlug, slugTouched])

  const reset = (): void => {
    setForm({ condoName: '', condoSlug: '', prompt: '' })
    setSlugTouched(false)
    setDraftSessionId(null)
    setPreview(null)
    setCommitted(null)
    setError(null)
  }

  const goBackToForm = (): void => {
    setPreview(null)
    setError(null)
  }

  const onPreview = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setError(null)
    setSubmitting('preview')
    try {
      const res = await fetch('/api/onboarding/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: draftSessionId ?? undefined,
          condoName: form.condoName,
          condoSlug: effectiveSlug,
          prompt: form.prompt,
        }),
      })
      const payload: unknown = await res.json().catch(() => ({}))
      if (!res.ok) {
        const message =
          typeof payload === 'object' && payload && 'error' in payload
            ? String((payload as { error: unknown }).error)
            : 'Falha ao gerar a prévia.'
        setError(message)
        return
      }
      const next = payload as PreviewPayload
      setDraftSessionId(next.session.id)
      setPreview(next)
    } catch {
      setError('Não foi possível conectar ao servidor. Tente novamente.')
    } finally {
      setSubmitting(null)
    }
  }

  const onCommit = async (): Promise<void> => {
    if (!preview) return
    setError(null)
    setSubmitting('commit')
    try {
      const res = await fetch('/api/onboarding/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: preview.session.id }),
      })
      const payload: unknown = await res.json().catch(() => ({}))
      if (!res.ok) {
        const message =
          typeof payload === 'object' && payload && 'error' in payload
            ? String((payload as { error: unknown }).error)
            : 'Falha ao confirmar o onboarding.'
        setError(message)
        return
      }
      setCommitted(payload as CommitSuccess)
    } catch {
      setError('Não foi possível concluir o onboarding. Tente novamente.')
    } finally {
      setSubmitting(null)
    }
  }

  if (committed) {
    return (
      <Card data-testid="onboarding-success" className="rounded-[4px]">
        <CardHeader>
          <CardTitle className="text-hidrogreen">Onboarding concluído</CardTitle>
          <CardDescription>
            O condomínio foi criado com {committed.counts.groups} grupos, {committed.counts.units} unidades,{' '}
            {committed.counts.submeters} submedidores e {committed.counts.masters} medidores principais.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="rounded-[4px] border bg-quicksilver/40 p-3">
            <div className="text-muted-foreground">Identificador</div>
            <div className="font-mono font-semibold" data-testid="onboarding-success-slug">
              {committed.condoSlug}
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild className="rounded-[4px] bg-hidrostone text-white hover:bg-hidrostone/90">
              <Link href="/">Ir para o início</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-[4px]">
              <Link href="/admin">Administração</Link>
            </Button>
            <Button variant="outline" className="rounded-[4px]" onClick={reset} type="button">
              Iniciar outro onboarding
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (preview) {
    return (
      <PreviewView
        preview={preview}
        error={error}
        submitting={submitting}
        onBack={goBackToForm}
        onConfirm={onCommit}
      />
    )
  }

  return (
    <FormView
      form={form}
      setForm={setForm}
      effectiveSlug={effectiveSlug}
      slugTouched={slugTouched}
      setSlugTouched={setSlugTouched}
      submitting={submitting}
      error={error}
      onSubmit={onPreview}
    />
  )
}

interface FormViewProps {
  form: FormState
  setForm: React.Dispatch<React.SetStateAction<FormState>>
  effectiveSlug: string
  slugTouched: boolean
  setSlugTouched: (next: boolean) => void
  submitting: 'preview' | 'commit' | null
  error: string | null
  onSubmit: (e: React.FormEvent) => Promise<void>
}

function FormView({
  form,
  setForm,
  effectiveSlug,
  slugTouched,
  setSlugTouched,
  submitting,
  error,
  onSubmit,
}: FormViewProps): React.JSX.Element {
  return (
    <Card className="rounded-[4px]">
      <CardHeader>
        <CardTitle>Texto descritivo</CardTitle>
        <CardDescription>
          Use frases curtas. Reconhecemos andares, torres, unidades por andar e medidores principais (masters) por andar/torre/condomínio.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-5" onSubmit={(e) => void onSubmit(e)} noValidate>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="onb-name">Nome do condomínio</Label>
              <Input
                id="onb-name"
                data-testid="onb-name"
                value={form.condoName}
                onChange={(e) => setForm((s) => ({ ...s, condoName: e.target.value }))}
                placeholder="Condomínio Aurora"
                disabled={submitting === 'preview'}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="onb-slug">Identificador</Label>
              <Input
                id="onb-slug"
                data-testid="onb-slug"
                value={slugTouched ? form.condoSlug : effectiveSlug}
                onChange={(e) => {
                  setSlugTouched(true)
                  setForm((s) => ({ ...s, condoSlug: e.target.value }))
                }}
                placeholder="condominio-aurora"
                disabled={submitting === 'preview'}
              />
              <p className="text-xs text-muted-foreground">
                Usado em URLs internas. Sem espaços, somente letras, números e &quot;-&quot;.
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="onb-prompt">Descrição da estrutura</Label>
            <Textarea
              id="onb-prompt"
              data-testid="onb-prompt"
              rows={6}
              placeholder={SAMPLE_PROMPT}
              value={form.prompt}
              onChange={(e) => setForm((s) => ({ ...s, prompt: e.target.value }))}
              disabled={submitting === 'preview'}
              required
            />
            <button
              type="button"
              className="text-xs text-hidrogreen underline-offset-2 hover:underline"
              onClick={() => setForm((s) => ({ ...s, prompt: SAMPLE_PROMPT }))}
              data-testid="onb-use-sample"
            >
              Usar exemplo
            </button>
          </div>

          {error ? (
            <Alert variant="destructive">
              <AlertDescription data-testid="onb-error">{error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="flex w-full flex-wrap items-center justify-end gap-3">
            <Button
              type="submit"
              data-testid="onb-preview-submit"
              aria-busy={submitting === 'preview'}
              className="rounded-[4px] bg-hidrostone font-bold uppercase text-white hover:bg-hidrostone/90"
              disabled={submitting === 'preview'}
            >
              {submitting === 'preview' ? (
                <>
                  <Spinner className="text-white" />
                  Gerando prévia…
                </>
              ) : (
                'Gerar prévia'
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

const MAX_PREVIEW_GROUP_DEPTH = 4

interface GroupTreeBranchProps {
  group: PreviewGroup
  depth: number
  childrenByParentId: Map<string | null, PreviewGroup[]>
  unitsByGroup: Map<string | null, PreviewUnit[]>
  subtreeUnitCountByGroupId: Map<string, number>
}

function GroupTreeBranch({
  group,
  depth,
  childrenByParentId,
  unitsByGroup,
  subtreeUnitCountByGroupId,
}: GroupTreeBranchProps): React.JSX.Element {
  const items = unitsByGroup.get(group.id) ?? []
  const children = (childrenByParentId.get(group.id) ?? []).filter((c) => c.id !== group.id)
  const nextDepth = depth + 1
  const subtreeTotal = subtreeUnitCountByGroupId.get(group.id) ?? items.length
  const directCount = items.length
  const unitSummary =
    directCount === subtreeTotal
      ? `${subtreeTotal} unidades`
      : `${subtreeTotal} unidades (${directCount} neste grupo)`

  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-semibold text-hidrostone" style={{ paddingLeft: depth * 12 }}>
          {group.name}
        </div>
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          {group.kind} · {unitSummary}
        </div>
      </div>
      {items.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5" style={{ paddingLeft: depth * 12 }}>
          {items.map((u) => (
            <span
              key={u.id}
              className="inline-flex rounded-[4px] border bg-quicksilver/50 px-2 py-0.5 font-mono text-xs"
            >
              {u.label}
            </span>
          ))}
        </div>
      ) : null}
      {children.length > 0 && nextDepth < MAX_PREVIEW_GROUP_DEPTH ? (
        <ul className="mt-2 border-l border-muted pl-3">
          {children.map((c) => (
            <GroupTreeBranch
              key={c.id}
              group={c}
              depth={nextDepth}
              childrenByParentId={childrenByParentId}
              unitsByGroup={unitsByGroup}
              subtreeUnitCountByGroupId={subtreeUnitCountByGroupId}
            />
          ))}
        </ul>
      ) : null}
    </li>
  )
}

interface PreviewViewProps {
  preview: PreviewPayload
  error: string | null
  submitting: 'preview' | 'commit' | null
  onBack: () => void
  onConfirm: () => Promise<void>
}

function PreviewView({ preview, error, submitting, onBack, onConfirm }: PreviewViewProps): React.JSX.Element {
  const unitsByGroup = useMemo(() => {
    const map = new Map<string | null, PreviewUnit[]>()
    for (const u of preview.units) {
      const key = u.tempGroupId ?? null
      const arr = map.get(key) ?? []
      arr.push(u)
      map.set(key, arr)
    }
    return map
  }, [preview.units])

  const childrenByParentId = useMemo(() => {
    const map = new Map<string | null, PreviewGroup[]>()
    for (const g of preview.groups) {
      const p = g.parentTempGroupId ?? null
      const arr = map.get(p) ?? []
      arr.push(g)
      map.set(p, arr)
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))
    }
    return map
  }, [preview.groups])

  const rootGroups = useMemo(() => {
    const ids = new Set(preview.groups.map((g) => g.id))
    const roots = preview.groups.filter((g) => {
      const p = g.parentTempGroupId
      return !p || !ids.has(p)
    })
    roots.sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))
    return roots
  }, [preview.groups])

  /** Direct units on this group + all units on descendant groups (for parent rows e.g. towers). */
  const subtreeUnitCountByGroupId = useMemo(() => {
    const memo = new Map<string, number>()
    function totalForGroup(groupId: string): number {
      const hit = memo.get(groupId)
      if (hit !== undefined) return hit
      let n = (unitsByGroup.get(groupId) ?? []).length
      for (const ch of childrenByParentId.get(groupId) ?? []) {
        if (ch.id === groupId) continue
        n += totalForGroup(ch.id)
      }
      memo.set(groupId, n)
      return n
    }
    for (const g of preview.groups) {
      totalForGroup(g.id)
    }
    return memo
  }, [preview.groups, childrenByParentId, unitsByGroup])

  const submeters = preview.meters.filter((m) => m.kind === 'submeter')
  const masters = preview.meters.filter((m) => m.kind === 'master')

  return (
    <div className="space-y-6" data-testid="onboarding-preview">
      <Card className="rounded-[4px]">
        <CardHeader>
          <CardTitle>{preview.session.condoName}</CardTitle>
          <CardDescription>
            <span className="font-mono">{preview.session.condoSlug}</span> · sessão{' '}
            <span className="font-mono">{preview.session.id.slice(0, 8)}…</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {preview.warnings.length > 0 ? (
            <div className="space-y-2" data-testid="onboarding-warnings">
              {preview.warnings.map((w, i) => (
                <Alert key={i}>
                  <AlertDescription>{w}</AlertDescription>
                </Alert>
              ))}
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatTile label="Grupos" value={preview.groups.length} testId="stat-groups" />
            <StatTile label="Unidades" value={preview.units.length} testId="stat-units" />
            <StatTile label="Submedidores" value={submeters.length} testId="stat-submeters" />
            <StatTile label="Medidores principais" value={masters.length} testId="stat-masters" />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-[4px]">
        <CardHeader>
          <CardTitle>Grupos e unidades</CardTitle>
        </CardHeader>
        <CardContent>
          {preview.groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum grupo gerado.</p>
          ) : (
            <ul className="divide-y rounded-[4px] border">
              {rootGroups.map((g) => (
                <GroupTreeBranch
                  key={g.id}
                  group={g}
                  depth={0}
                  childrenByParentId={childrenByParentId}
                  unitsByGroup={unitsByGroup}
                  subtreeUnitCountByGroupId={subtreeUnitCountByGroupId}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-[4px]">
        <CardHeader>
          <CardTitle>Medidores principais</CardTitle>
          <CardDescription>Cada submedidor é gerado automaticamente para a unidade correspondente.</CardDescription>
        </CardHeader>
        <CardContent>
          {masters.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum master detectado no texto.</p>
          ) : (
            <ul className="divide-y rounded-[4px] border">
              {masters.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <span className="font-mono text-xs uppercase tracking-wide text-hidrostone">
                    master · {m.targetKind}
                  </span>
                  <span className="text-sm">{renderMasterTarget(m, preview)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription data-testid="onb-error">{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="outline"
          className="rounded-[4px]"
          onClick={onBack}
          type="button"
          data-testid="onb-back"
          disabled={submitting === 'commit'}
        >
          Editar texto
        </Button>
        <Button
          type="button"
          data-testid="onb-commit"
          className="rounded-[4px] bg-hidrogreen font-bold uppercase text-white hover:bg-hidrogreen/90"
          disabled={submitting === 'commit'}
          onClick={() => void onConfirm()}
        >
          {submitting === 'commit' ? 'Confirmando…' : 'Confirmar e criar'}
        </Button>
      </div>
    </div>
  )
}

function renderMasterTarget(m: PreviewMeter, preview: PreviewPayload): string {
  if (m.targetKind === 'condo') return 'Condomínio inteiro'
  if (m.targetKind === 'group') {
    const g = preview.groups.find((x) => x.id === m.targetTempGroupId)
    return g ? `Grupo · ${g.name}` : 'Grupo'
  }
  const u = preview.units.find((x) => x.id === m.targetTempUnitId)
  return u ? `Unidade · ${u.label}` : 'Unidade'
}

interface StatTileProps {
  label: string
  value: number
  testId: string
}

function StatTile({ label, value, testId }: StatTileProps): React.JSX.Element {
  return (
    <div className="rounded-[4px] border bg-card p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-bold text-hidrostone" data-testid={testId}>
        {value}
      </div>
    </div>
  )
}
