import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'

import { Button } from '@/components/ui/button'
import { authOptions } from '@/lib/auth'
import { parseMetersQuery } from '@/lib/validation/meters'
import { buildMetersListing, loadCondoMeters } from '@/modules/meters'
import { listAccessibleCondos } from '@/modules/rbac'

import { CondoSwitcher } from './CondoSwitcher'
import { MetersGroupedList } from './MetersGroupedList'

export const dynamic = 'force-dynamic'

interface MetersPageProps {
  searchParams?: Record<string, string | string[] | undefined>
}

export default async function MetersPage({
  searchParams,
}: MetersPageProps): Promise<React.JSX.Element> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    redirect('/?login=1')
  }

  const condos = await listAccessibleCondos(session.user.id, session.user.role)
  if (condos.length === 0) {
    return <NoCondoState role={session.user.role} />
  }

  const { condoSlug } = parseMetersQuery({
    condo: searchParams?.condo,
    groupKind: searchParams?.groupKind,
  })

  const selected =
    (condoSlug && condos.find((c) => c.slug === condoSlug)) ?? condos[0]
  if (!selected) {
    return <NoCondoState role={session.user.role} />
  }

  const bundle = await loadCondoMeters(selected.id)
  if (!bundle) {
    return <NoCondoState role={session.user.role} />
  }

  const listing = buildMetersListing(bundle)

  return (
    <div className="container max-w-5xl space-y-6 py-6" data-testid="meters-page">
      <header className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold text-hidrostone">Medidores</h1>
            <p className="text-muted-foreground">
              Lista de medidores ativos do condomínio, agrupados pela estrutura cadastrada.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {condos.length > 1 ? (
              <CondoSwitcher condos={condos} currentSlug={selected.slug} />
            ) : null}
            <Button
              asChild
              className="rounded-[4px] bg-hidrogreen font-bold uppercase text-white hover:bg-hidrogreen/90"
            >
              <Link
                href={`/meters/print?condo=${encodeURIComponent(selected.slug)}`}
                data-testid="meters-print-link"
              >
                Imprimir QR
              </Link>
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Grupos" value={bundle.groups.length} testId="meters-stat-groups" />
          <Stat label="Unidades" value={bundle.units.length} testId="meters-stat-units" />
          <Stat
            label="Submedidores"
            value={listing.totalSubmeters}
            testId="meters-stat-submeters"
          />
          <Stat
            label="Principais"
            value={listing.masters.length}
            testId="meters-stat-masters"
          />
        </div>
      </header>

      <MetersGroupedList
        rootGroups={listing.rootGroups}
        ungroupedUnits={listing.ungroupedUnits}
        masters={listing.masters}
      />
    </div>
  )
}

function Stat({
  label,
  value,
  testId,
}: {
  label: string
  value: number
  testId: string
}): React.JSX.Element {
  return (
    <div className="rounded-[4px] border bg-card p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold text-hidrostone" data-testid={testId}>
        {value}
      </p>
    </div>
  )
}

function NoCondoState({ role }: { role: string | undefined }): React.JSX.Element {
  const isStaff = role === 'admin' || role === 'system_admin'
  return (
    <div
      className="container max-w-3xl space-y-4 py-6"
      data-testid="meters-empty-state"
    >
      <header className="space-y-1">
        <h1 className="text-3xl font-bold text-hidrostone">Medidores</h1>
        <p className="text-muted-foreground">
          Você ainda não tem acesso a nenhum condomínio com medidores cadastrados.
        </p>
      </header>
      <div className="rounded-[4px] border bg-card p-4 text-sm">
        {isStaff ? (
          <p>
            Comece criando um condomínio em{' '}
            <Link href="/onboarding" className="text-hidrogreen underline-offset-2 hover:underline">
              /onboarding
            </Link>
            .
          </p>
        ) : (
          <p>
            Solicite ao administrador do condomínio uma concessão de papel (operador, editor ou
            administrador) para visualizar os medidores.
          </p>
        )}
      </div>
    </div>
  )
}
