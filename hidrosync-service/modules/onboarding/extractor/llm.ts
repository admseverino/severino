import { z } from 'zod'

import { MockOnboardingExtractor } from './mock'
import { clampGroupsToMaxDepth } from '../group-tree'
import type {
  ExtractedGroup,
  ExtractedMeter,
  ExtractedStructure,
  ExtractedUnit,
  OnboardingExtractor,
} from './types'

/**
 * Generic OpenAI-compatible chat-completions adapter. OpenAI and OpenRouter share the same
 * request/response shape, so we drive both through one class; the factory in
 * `./index.ts` constructs the right configuration per provider.
 */

const llmGroupSchema = z.object({
  name: z.string().min(1).max(120),
  kind: z.enum(['floor', 'tower', 'block', 'villa_cluster', 'custom']).default('custom'),
  /** Must exactly match another group's `name` (the parent). Null/omit = root. Max depth from root = 4. */
  parentGroupName: z.union([z.string(), z.null()]).optional(),
})

const llmUnitSchema = z.object({
  label: z.string().min(1).max(64),
  groupName: z.union([z.string(), z.null()]).optional(),
})

const llmMasterSchema = z.discriminatedUnion('target', [
  z.object({ target: z.literal('condo'), identifier: z.string().optional().nullable() }),
  z.object({
    target: z.literal('group'),
    groupName: z.string().min(1),
    identifier: z.string().optional().nullable(),
  }),
  z.object({
    target: z.literal('unit'),
    unitLabel: z.string().min(1),
    identifier: z.string().optional().nullable(),
  }),
])

const llmPayloadSchema = z.object({
  groups: z.array(llmGroupSchema).default([]),
  units: z.array(llmUnitSchema).default([]),
  masters: z.array(llmMasterSchema).default([]),
  warnings: z.array(z.string()).default([]),
})

type LlmPayload = z.infer<typeof llmPayloadSchema>

const SYSTEM_PROMPT = `Você é um extrator estruturado para o onboarding de condomínios. 
A partir do texto livre do usuário, extraia a estrutura do condomínio e devolva APENAS JSON válido.

FORMATO:
- Devolva APENAS JSON válido, sem texto explicativo, sem cercas Markdown.

GRUPOS (árvore, até 4 níveis):
- Cada item em "groups" é um nó da árvore: torres, andares, blocos, clusters, etc.
- "parentGroupName": use null ou omita o campo para grupos RAIZ (sem pai no JSON).
  Para um grupo filho, "parentGroupName" deve ser a string EXATAMENTE igual ao campo "name"
  do grupo pai (mesma grafia, capitalização e espaços). O pai deve existir em "groups".
- Profundidade: conte a partir da raiz como nível 1. O caminho da raiz até qualquer folha
  pode ter no máximo 4 nós (ex.: raiz → torre → andar → setor = 4 níveis; não adicione um 5º).
- Unicidade de "name": cada "name" em "groups" deve ser ÚNICO em todo o JSON (não repita o mesmo
  "name" em dois objetos). Se o texto tiver "Andar 1" em duas torres, use nomes distintos no JSON,
  por exemplo "Torre A — Andar 1" e "Torre B — Andar 1", ou prefixos claros que você listar.
- A ordem dos objetos em "groups" é livre; o importante é que cada "parentGroupName" aponte para
  um "name" de pai que você definiu.
- "kind" em cada grupo (obrigatório):
  - "floor": andares, pavimentos ou níveis numéricos (ex.: "10 andares").
  - "tower": torres ou blocos nomeados por letra/nome (ex.: "Torre A", "Bloco B").
  - "block": quadras ou setores urbanísticos (não confundir com torre nomeada "Bloco B").
  - "villa_cluster": loteamento, conjunto de casas, vilas em cluster.
  - "custom": quando nenhum dos acima se aplica de forma clara.

UNIDADES:
- O array "units" deve listar **exatamente uma linha por unidade física**. O campo "label" é o
  identificador global da unidade: **não pode haver dois objetos com o mesmo "label"** — se
  repetir o mesmo texto em duas linhas, a segunda será descartada e gerará aviso.
- Cada unidade no JSON precisa de um "label" distinto. Prefixe conforme fizer sentido com os "groups" que 
  você criou ou conforme informado pelo usuario (ex.: "1001A" e "1001B" em duas torres). 
- "groupName": aponte para o grupo FOLHA onde a unidade está (string exata de um "groups[].name").
  Uma única linha em "units" por unidade: use "groupName" para dizer o andar/torre; não duplique
  unidades só para mudar de grupo.
- Não use apelidos nem sinônimos em relação aos nomes que você listou em "groups".

MASTERS (medidores principais / hidrômetros gerais):
- "target": "condo" | "group" | "unit".
- "condo": medidor geral do condomínio inteiro.
- "group": "groupName" deve ser EXATAMENTE um "groups[].name" existente (pode ser raiz, torre,
  andar ou outro nó — conforme o texto: master por torre, por andar, etc.).
- "unit": "unitLabel" deve ser EXATAMENTE um "units[].label" existente.
- Nunca invente nomes de grupo ou rótulos de unidade que não apareçam no JSON.

SUBMEDIDORES:
- NÃO inclua submedidores em "masters"; o sistema cria 1 submedidor por unidade automaticamente.

AVISOS:
- Se algo for implícito mas razoável, deduza e registre em "warnings".
- Se o texto for ambíguo ou faltar dados, devolva o melhor possível e explique em "warnings".

SCHEMA EXATO do JSON:
{
  "groups": [{"name": string, "kind": "floor"|"tower"|"block"|"villa_cluster"|"custom", "parentGroupName": string | null}],
  "units":  [{"label": string, "groupName": string | null}],
  "masters":[
    {"target": "condo", "identifier": string | null} |
    {"target": "group", "groupName": string, "identifier": string | null} |
    {"target": "unit",  "unitLabel": string,  "identifier": string | null}
  ],
  "warnings": [string]
}`

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>
  model?: string
}

/** Turn fetch/abort/network failures into short Portuguese text for UI warnings. */
function formatLlmClientError(err: unknown, timeoutMs: number): string {
  const seconds = Math.max(1, Math.round(timeoutMs / 1000))
  if (typeof DOMException !== 'undefined' && err instanceof DOMException && err.name === 'AbortError') {
    return `tempo limite da API (${seconds}s) — a resposta não chegou a tempo; tente de novo ou aumente ONBOARDING_LLM_TIMEOUT_MS no servidor`
  }
  if (err instanceof Error) {
    const name = err.name
    const msg = err.message
    const lower = msg.toLowerCase()
    if (
      name === 'AbortError' ||
      lower.includes('aborted') ||
      lower.includes('operation was aborted') ||
      lower.includes('the user aborted')
    ) {
      return `tempo limite da API (${seconds}s) — a resposta não chegou a tempo; tente de novo ou aumente ONBOARDING_LLM_TIMEOUT_MS no servidor`
    }
    return msg
  }
  return 'erro desconhecido'
}

export type LlmProvider = 'openai' | 'openrouter'

export interface LlmExtractorOptions {
  provider: LlmProvider
  endpoint: string
  apiKey: string
  model: string
  /** Extra headers (e.g. OpenRouter attribution). */
  extraHeaders?: Record<string, string>
  timeoutMs?: number
  onCall?: (info: { provider: LlmProvider; model: string; latencyMs: number; parsedOk: boolean }) => void
}

export class LlmOnboardingExtractor implements OnboardingExtractor {
  private readonly opts: Required<Omit<LlmExtractorOptions, 'onCall' | 'extraHeaders'>> & {
    extraHeaders: Record<string, string>
    onCall?: LlmExtractorOptions['onCall']
  }
  private readonly fallback = new MockOnboardingExtractor()

  constructor(opts: LlmExtractorOptions) {
    this.opts = {
      provider: opts.provider,
      endpoint: opts.endpoint,
      apiKey: opts.apiKey,
      model: opts.model,
      timeoutMs: opts.timeoutMs ?? 25_000,
      extraHeaders: opts.extraHeaders ?? {},
      onCall: opts.onCall,
    }
  }

  async extract(prompt: string): Promise<ExtractedStructure> {
    const started = Date.now()
    try {
      const payload = await this.callChatCompletions(prompt)
      const structure = toStructure(payload)
      this.opts.onCall?.({
        provider: this.opts.provider,
        model: this.opts.model,
        latencyMs: Date.now() - started,
        parsedOk: true,
      })
      return structure
    } catch (err) {
      this.opts.onCall?.({
        provider: this.opts.provider,
        model: this.opts.model,
        latencyMs: Date.now() - started,
        parsedOk: false,
      })
      const message = formatLlmClientError(err, this.opts.timeoutMs)
      // Fail safe: drop back to the deterministic mock so the operator never sees a 500.
      const fallback = await this.fallback.extract(prompt)
      return {
        ...fallback,
        warnings: [
          `Não foi possível usar o extrator ${this.opts.provider}: ${message}. Usando análise determinística como alternativa.`,
          ...fallback.warnings,
        ],
      }
    }
  }

  private async callChatCompletions(prompt: string): Promise<LlmPayload> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.opts.timeoutMs)
    try {
      const res = await fetch(this.opts.endpoint, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${this.opts.apiKey}`,
          'Content-Type': 'application/json',
          ...this.opts.extraHeaders,
        },
        body: JSON.stringify({
          model: this.opts.model,
          response_format: { type: 'json_object' },
          // Omit temperature: frontier models (e.g. gpt-5.5) reject 0 and only allow default (1).
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: prompt },
          ],
        }),
      })
      if (!res.ok) {
        const errText = await res.text().catch(() => '')
        throw new Error(`${this.opts.provider} ${res.status}: ${errText.slice(0, 200)}`)
      }
      const body = (await res.json()) as ChatCompletionResponse
      const content = body.choices?.[0]?.message?.content
      if (!content) {
        throw new Error('Resposta vazia do modelo')
      }
      const json: unknown = JSON.parse(stripJsonFences(content))
      const parsed = llmPayloadSchema.safeParse(json)
      if (!parsed.success) {
        throw new Error(`JSON do modelo inválido: ${parsed.error.issues[0]?.message ?? 'schema'}`)
      }
      return parsed.data
    } finally {
      clearTimeout(timeout)
    }
  }
}

/** Some models wrap JSON in ```json … ``` even when asked not to; tolerate that. */
function stripJsonFences(text: string): string {
  const trimmed = text.trim()
  if (trimmed.startsWith('```')) {
    return trimmed
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim()
  }
  return trimmed
}

interface NormalizedLlmGroupRow {
  name: string
  kind: ExtractedGroup['kind']
  /** Valid parent name within the deduped set, or null. */
  parentName: string | null
  sourceOrder: number
}

interface TopoLlmGroupsResult {
  order: string[]
  parentByName: Map<string, string | null>
}

/**
 * Breadth-first topological order (parents before children). Breaks cycles by clearing one parent
 * link per iteration until all nodes are reachable from roots.
 */
function topoOrderLlmGroupNames(rows: NormalizedLlmGroupRow[], warnings: string[]): TopoLlmGroupsResult {
  const byName = new Map(rows.map((r) => [r.name, r]))
  const parentOf = new Map<string, string | null>(rows.map((r) => [r.name, r.parentName]))

  while (true) {
    const children = new Map<string | null, string[]>()
    for (const r of rows) {
      const p = parentOf.get(r.name) ?? null
      const list = children.get(p) ?? []
      list.push(r.name)
      children.set(p, list)
    }
    for (const list of children.values()) {
      list.sort(
        (a, b) =>
          (byName.get(a)!.sourceOrder - byName.get(b)!.sourceOrder) || a.localeCompare(b, 'pt')
      )
    }

    const roots = rows
      .filter((r) => parentOf.get(r.name) === null)
      .sort((a, b) => a.sourceOrder - b.sourceOrder)
      .map((r) => r.name)

    const order: string[] = []
    const queue = [...roots]
    const seen = new Set<string>()
    while (queue.length) {
      const n = queue.shift()!
      if (seen.has(n)) continue
      seen.add(n)
      order.push(n)
      for (const c of children.get(n) ?? []) {
        queue.push(c)
      }
    }

    if (order.length === rows.length) {
      return { order, parentByName: parentOf }
    }

    const unseen = rows
      .filter((r) => !seen.has(r.name))
      .sort((a, b) => a.sourceOrder - b.sourceOrder)
    const victim = unseen[0]!
    warnings.push(
      `Hierarquia de grupos inconsistente (ciclo ou referência inválida envolvendo "${victim.name}"); esse nó foi tratado como raiz.`
    )
    parentOf.set(victim.name, null)
  }
}

function toStructure(payload: LlmPayload): ExtractedStructure {
  const warnings = [...payload.warnings]

  const seenNames = new Set<string>()
  const uniqueRows: NormalizedLlmGroupRow[] = []
  for (let idx = 0; idx < payload.groups.length; idx++) {
    const g = payload.groups[idx]!
    if (seenNames.has(g.name)) {
      warnings.push(`Grupo duplicado ignorado: "${g.name}".`)
      continue
    }
    seenNames.add(g.name)
    const raw = g.parentGroupName
    const trimmed =
      raw === undefined || raw === null
        ? null
        : (() => {
            const t = String(raw).trim()
            return t.length ? t : null
          })()
    let parentName = trimmed
    if (parentName === g.name) {
      warnings.push(`Grupo "${g.name}": não pode ser pai de si mesmo; tratado como raiz.`)
      parentName = null
    }
    uniqueRows.push({
      name: g.name,
      kind: g.kind,
      parentName,
      sourceOrder: idx,
    })
  }

  const finalNames = new Set(uniqueRows.map((r) => r.name))
  for (const r of uniqueRows) {
    if (r.parentName && !finalNames.has(r.parentName)) {
      warnings.push(`Grupo "${r.name}": pai "${r.parentName}" não encontrado; tratado como raiz.`)
      r.parentName = null
    }
  }

  const byNameRow = new Map(uniqueRows.map((r) => [r.name, r]))
  const { order: orderedNames, parentByName } = topoOrderLlmGroupNames(uniqueRows, warnings)
  const nameToTempKey = new Map<string, string>()
  let groups: ExtractedGroup[] = orderedNames.map((name, i) => {
    const row = byNameRow.get(name)!
    const parentName = parentByName.get(name) ?? null
    const parentTempKey = parentName ? nameToTempKey.get(parentName) ?? null : null
    if (parentName && !parentTempKey) {
      warnings.push(`Grupo "${name}": não foi possível resolver o pai; tratado como raiz.`)
    }
    const tempKey = `g_${i + 1}`
    nameToTempKey.set(name, tempKey)
    return {
      tempKey,
      parentTempKey: parentName && parentTempKey ? parentTempKey : null,
      name: row.name,
      kind: row.kind,
      sortOrder: i + 1,
    }
  })

  groups = clampGroupsToMaxDepth(groups, warnings)

  const groupKeyByName = new Map(groups.map((g) => [g.name, g.tempKey]))

  const unitLabels = new Set<string>()
  const units: ExtractedUnit[] = []
  payload.units.forEach((u, idx) => {
    if (unitLabels.has(u.label)) {
      warnings.push(`Unidade duplicada ignorada: "${u.label}".`)
      return
    }
    unitLabels.add(u.label)
    const groupKey = u.groupName ? (groupKeyByName.get(u.groupName) ?? null) : null
    if (u.groupName && !groupKey) {
      warnings.push(`Unidade "${u.label}" referencia grupo desconhecido "${u.groupName}"; unidade ficou sem grupo.`)
    }
    units.push({
      tempKey: `u_${idx + 1}`,
      groupTempKey: groupKey,
      label: u.label,
      sortOrder: idx + 1,
    })
  })

  const unitKeyByLabel = new Map(units.map((u) => [u.label, u.tempKey]))

  let meterOrder = 0
  const meters: ExtractedMeter[] = []
  for (const u of units) {
    meterOrder += 1
    meters.push({
      tempKey: `m_sub_${u.tempKey}`,
      kind: 'submeter',
      identifier: null,
      target: { kind: 'unit', tempKey: u.tempKey },
      sortOrder: meterOrder,
    })
  }

  payload.masters.forEach((m, idx) => {
    meterOrder += 1
    if (m.target === 'condo') {
      meters.push({
        tempKey: `m_master_condo_${idx + 1}`,
        kind: 'master',
        identifier: m.identifier ?? null,
        target: { kind: 'condo' },
        sortOrder: meterOrder,
      })
      return
    }
    if (m.target === 'group') {
      const groupKey = groupKeyByName.get(m.groupName)
      if (!groupKey) {
        warnings.push(`Master de grupo "${m.groupName}" descartado: grupo não encontrado.`)
        return
      }
      meters.push({
        tempKey: `m_master_grp_${idx + 1}`,
        kind: 'master',
        identifier: m.identifier ?? null,
        target: { kind: 'group', tempKey: groupKey },
        sortOrder: meterOrder,
      })
      return
    }
    const unitKey = unitKeyByLabel.get(m.unitLabel)
    if (!unitKey) {
      warnings.push(`Master de unidade "${m.unitLabel}" descartado: unidade não encontrada.`)
      return
    }
    meters.push({
      tempKey: `m_master_unit_${idx + 1}`,
      kind: 'master',
      identifier: m.identifier ?? null,
      target: { kind: 'unit', tempKey: unitKey },
      sortOrder: meterOrder,
    })
  })

  if (units.length === 0) {
    warnings.push('O modelo não retornou nenhuma unidade. Reescreva o texto com mais detalhes.')
  }

  return { groups, units, meters, warnings }
}
