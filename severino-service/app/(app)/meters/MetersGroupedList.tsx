import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import {
  GROUP_KIND_LABEL,
  type GroupNode,
  type MasterEntry,
  type UnitWithMeters,
  masterPrintTitle,
} from '@/modules/meters'

interface MetersGroupedListProps {
  rootGroups: GroupNode[]
  ungroupedUnits: UnitWithMeters[]
  masters: MasterEntry[]
}

export function MetersGroupedList({
  rootGroups,
  ungroupedUnits,
  masters,
}: MetersGroupedListProps): React.JSX.Element {
  const hasSubmeterContent = rootGroups.length > 0 || ungroupedUnits.length > 0
  return (
    <div className="space-y-6" data-testid="meters-grouped-list">
      <section className="space-y-3">
        <h2 className="text-lg font-bold uppercase tracking-wide text-severinostone">
          Submedidores
        </h2>
        {hasSubmeterContent ? (
          <ul className="space-y-3" data-testid="meters-groups-tree">
            {rootGroups.map((node) => (
              <GroupBranch key={node.group.id} node={node} />
            ))}
            {ungroupedUnits.length > 0 ? (
              <li
                className="rounded-[4px] border bg-card p-3"
                data-testid="meters-ungrouped-section"
              >
                <h3 className="text-sm font-semibold uppercase tracking-wide text-severinostone">
                  Sem grupo
                </h3>
                <UnitsRow units={ungroupedUnits} />
              </li>
            ) : null}
          </ul>
        ) : (
          <EmptyState>Sem unidades cadastradas para este condomínio.</EmptyState>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold uppercase tracking-wide text-severinostone">
          Medidores principais
        </h2>
        {masters.length === 0 ? (
          <EmptyState>Nenhum medidor principal cadastrado.</EmptyState>
        ) : (
          <ul
            className="divide-y rounded-[4px] border bg-card"
            data-testid="meters-masters-list"
          >
            {masters.map((m) => (
              <li
                key={m.meter.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div>
                  <p className="font-semibold text-severinostone">{masterPrintTitle(m)}</p>
                  {m.meter.identifier ? (
                    <p className="font-mono text-xs text-muted-foreground">
                      {m.meter.identifier}
                    </p>
                  ) : null}
                </div>
                <Link
                  href={`/reading/${m.meter.id}`}
                  className="text-sm font-semibold uppercase tracking-wide text-severinogreen underline-offset-2 hover:underline"
                  data-testid={`meter-link-${m.meter.id}`}
                >
                  Abrir leitura
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function GroupBranch({ node }: { node: GroupNode }): React.JSX.Element {
  const totalUnits = countSubtreeUnits(node)
  return (
    <li
      className="rounded-[4px] border bg-card p-3"
      style={{ marginLeft: node.depth > 0 ? node.depth * 12 : 0 }}
      data-testid={`meters-group-${node.group.id}`}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-severinostone">
          {node.group.name}
        </h3>
        <Badge variant="outline" className="rounded-[4px] uppercase">
          {GROUP_KIND_LABEL[node.group.kind]} · {totalUnits} unidades
        </Badge>
      </header>
      {node.directUnits.length > 0 ? <UnitsRow units={node.directUnits} /> : null}
      {node.children.length > 0 ? (
        <ul className="mt-2 space-y-2 border-l border-muted pl-3">
          {node.children.map((child) => (
            <GroupBranch key={child.group.id} node={child} />
          ))}
        </ul>
      ) : null}
    </li>
  )
}

function UnitsRow({ units }: { units: UnitWithMeters[] }): React.JSX.Element {
  return (
    <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {units.map((u) => (
        <li
          key={u.unit.id}
          className="flex items-center justify-between gap-2 rounded-[4px] border bg-white px-3 py-2"
          data-testid={`meters-unit-${u.unit.id}`}
        >
          <div>
            <p className="font-mono text-sm font-semibold text-severinostone">{u.unit.label}</p>
            <p className="text-xs text-muted-foreground">
              {u.submeters.length === 0
                ? 'Sem submedidor'
                : `${u.submeters.length} submedidor${u.submeters.length > 1 ? 'es' : ''}`}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            {u.submeters.map((m) => (
              <Link
                key={m.id}
                href={`/reading/${m.id}`}
                className="text-xs font-semibold uppercase tracking-wide text-severinogreen underline-offset-2 hover:underline"
                data-testid={`meter-link-${m.id}`}
              >
                {u.submeters.length > 1 ? (m.identifier ?? m.id.slice(0, 6)) : 'Abrir leitura'}
              </Link>
            ))}
          </div>
        </li>
      ))}
    </ul>
  )
}

function EmptyState({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="rounded-[4px] border bg-card p-4 text-sm text-muted-foreground">
      {children}
    </div>
  )
}

function countSubtreeUnits(node: GroupNode): number {
  let total = node.directUnits.length
  for (const c of node.children) total += countSubtreeUnits(c)
  return total
}
