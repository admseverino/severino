'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Printer } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
// Import from the leaf module (not the `@/modules/meters` barrel) to keep the DB-bound
// `repository.ts` out of the client bundle — otherwise webpack pulls `pg` in via re-exports.
import { GROUP_KIND_LABEL, PRINT_GROUP_KINDS, type PrintGroupKind } from '@/modules/meters/service'

interface PrintControlsProps {
  condoSlug: string
  groupKind: PrintGroupKind
  /** Group kinds that actually appear in this condo — the others are hidden to avoid empty pages. */
  availableGroupKinds: readonly PrintGroupKind[]
}

const LABEL: Record<PrintGroupKind, string> = {
  none: 'Sem agrupamento',
  tower: GROUP_KIND_LABEL.tower,
  block: GROUP_KIND_LABEL.block,
  floor: GROUP_KIND_LABEL.floor,
  villa_cluster: GROUP_KIND_LABEL.villa_cluster,
  custom: GROUP_KIND_LABEL.custom,
}

export function PrintControls({
  condoSlug,
  groupKind,
  availableGroupKinds,
}: PrintControlsProps): React.JSX.Element {
  const router = useRouter()
  const params = useSearchParams()

  const onGroupKindChange = (next: string): void => {
    if (next === groupKind) return
    const sp = new URLSearchParams(params.toString())
    sp.set('condo', condoSlug)
    if (next === 'none') sp.delete('groupKind')
    else sp.set('groupKind', next)
    router.replace(`?${sp.toString()}`)
  }

  const onPrint = (): void => {
    if (typeof window !== 'undefined') window.print()
  }

  const optionKinds = PRINT_GROUP_KINDS.filter((k) => availableGroupKinds.includes(k))

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Agrupar por
        </label>
        <Select value={groupKind} onValueChange={onGroupKindChange}>
          <SelectTrigger
            size="sm"
            className="w-[200px] rounded-[4px]"
            data-testid="print-groupkind-select"
            aria-label="Agrupamento para impressão"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {optionKinds.map((k) => (
              <SelectItem key={k} value={k}>
                {LABEL[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="outline" className="rounded-[4px]">
          <Link href={`/meters?condo=${encodeURIComponent(condoSlug)}`}>Voltar</Link>
        </Button>
        <Button
          type="button"
          onClick={onPrint}
          data-testid="print-trigger"
          className="rounded-[4px] bg-severinostone font-bold uppercase text-white hover:bg-severinostone/90"
        >
          <Printer className="mr-2 h-4 w-4" />
          Imprimir
        </Button>
      </div>
    </div>
  )
}
