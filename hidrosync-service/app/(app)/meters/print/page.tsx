import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'

import { QrLabel } from '@/components/qr/QrLabel'
import { authOptions } from '@/lib/auth'
import { parseMetersQuery } from '@/lib/validation/meters'
import {
  buildMetersListing,
  buildPrintLayout,
  loadCondoMeters,
  masterPrintTitle,
  qrUrlFor,
  renderQrSvg,
  resolveBaseUrl,
  type GroupKind,
  type MasterEntry,
  type PrintGroupKind,
  type SubmeterCard,
} from '@/modules/meters'
import { listAccessibleCondos } from '@/modules/rbac'

import { PrintControls } from './PrintControls'

export const dynamic = 'force-dynamic'

interface PrintPageProps {
  searchParams?: Record<string, string | string[] | undefined>
}

export default async function MetersPrintPage({
  searchParams,
}: PrintPageProps): Promise<React.JSX.Element> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    redirect('/?login=1')
  }

  const condos = await listAccessibleCondos(session.user.id, session.user.role)
  if (condos.length === 0) {
    return <EmptyPrint message="Você ainda não tem acesso a nenhum condomínio." />
  }

  const { condoSlug, groupKind } = parseMetersQuery({
    condo: searchParams?.condo,
    groupKind: searchParams?.groupKind,
  })

  const selected =
    (condoSlug && condos.find((c) => c.slug === condoSlug)) ?? condos[0]
  if (!selected) {
    return <EmptyPrint message="Condomínio não encontrado." />
  }

  const bundle = await loadCondoMeters(selected.id)
  if (!bundle) {
    return <EmptyPrint message="Condomínio sem dados de medidores." />
  }

  const listing = buildMetersListing(bundle)
  const layout = buildPrintLayout(listing, groupKind)
  const availableGroupKinds = computeAvailableKinds(bundle.groups.map((g) => g.kind))

  const headerList = headers()
  const proto =
    headerList.get('x-forwarded-proto') ??
    (process.env.NODE_ENV === 'development' ? 'http' : 'https')
  const host = headerList.get('x-forwarded-host') ?? headerList.get('host') ?? 'localhost:3000'
  const baseUrl = resolveBaseUrl(`${proto}://${host}`)

  const renderedSections = await Promise.all(
    layout.sections.map(async (section) => ({
      title: section.title,
      subtitle: section.subtitle ?? null,
      cards: await Promise.all(
        section.submeters.map(async (card) => ({
          card,
          qrUrl: qrUrlFor(card.meter.id, baseUrl),
          qrSvg: await renderQrSvg(qrUrlFor(card.meter.id, baseUrl)),
        }))
      ),
    }))
  )

  const renderedMasters = await Promise.all(
    layout.masters.map(async (m) => ({
      master: m,
      qrUrl: qrUrlFor(m.meter.id, baseUrl),
      qrSvg: await renderQrSvg(qrUrlFor(m.meter.id, baseUrl)),
    }))
  )

  return (
    <div className="space-y-6 py-6 print:space-y-0 print:py-0" data-testid="meters-print-page">
      <div className="container max-w-5xl space-y-3 print:hidden">
        <header className="space-y-1">
          <h1 className="text-3xl font-bold text-hidrostone">Impressão de QR Codes</h1>
          <p className="text-muted-foreground">
            Cada submedidor e medidor principal recebe sua etiqueta. Imprima em A4 e cole nos
            hidrômetros.
          </p>
        </header>
        <PrintControls
          condoSlug={selected.slug}
          groupKind={layout.groupKind as PrintGroupKind}
          availableGroupKinds={availableGroupKinds}
        />
      </div>

      <div
        className="container max-w-5xl space-y-8 print:max-w-none print:space-y-0 print:p-0"
        data-testid="print-sheet"
      >
        {renderedSections.length === 0 ? (
          <EmptyPrint message="Nenhum submedidor para imprimir." />
        ) : (
          renderedSections.map((section, idx) => (
            <SubmeterSection
              key={`${section.title}-${idx}`}
              title={section.title}
              subtitle={section.subtitle}
              cards={section.cards}
              condoName={layout.condo.name}
              condoLogoUrl={layout.condo.logoImage}
              breakAfter={idx < renderedSections.length - 1 || renderedMasters.length > 0}
            />
          ))
        )}

        {renderedMasters.length > 0 ? (
          <MastersSection
            condoName={layout.condo.name}
            condoLogoUrl={layout.condo.logoImage}
            masters={renderedMasters}
          />
        ) : null}
      </div>
    </div>
  )
}

interface RenderedCard {
  card: SubmeterCard
  qrUrl: string
  qrSvg: string
}

interface SubmeterSectionProps {
  title: string
  subtitle: string | null
  cards: RenderedCard[]
  condoName: string
  condoLogoUrl: string | null
  breakAfter: boolean
}

function SubmeterSection({
  title,
  subtitle,
  cards,
  condoName,
  condoLogoUrl,
  breakAfter,
}: SubmeterSectionProps): React.JSX.Element {
  return (
    <section
      className={breakAfter ? 'print:break-after-page' : ''}
      data-testid="print-submeter-section"
    >
      <header className="mb-4 print:mb-3">
        {subtitle ? (
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground print:text-black">
            {subtitle}
          </p>
        ) : null}
        <h2 className="text-xl font-bold uppercase text-hidrostone print:text-black">{title}</h2>
      </header>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 print:grid-cols-3 print:gap-1.5">
        {cards.map(({ card, qrUrl, qrSvg }) => (
          <QrLabel
            key={card.meter.id}
            qrSvg={qrSvg}
            qrUrl={qrUrl}
            condoName={condoName}
            condoLogoUrl={condoLogoUrl}
            title={card.unit.label}
            meterIdLine={
              card.showMeterId ? card.meter.identifier ?? card.meter.id.slice(0, 8) : null
            }
          />
        ))}
      </div>
    </section>
  )
}

interface MastersSectionProps {
  condoName: string
  condoLogoUrl: string | null
  masters: { master: MasterEntry; qrUrl: string; qrSvg: string }[]
}

function MastersSection({
  condoName,
  condoLogoUrl,
  masters,
}: MastersSectionProps): React.JSX.Element {
  return (
    <section data-testid="print-masters-section" className="print:break-before-page">
      <header className="mb-4 print:mb-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground print:text-black">
          Página dedicada
        </p>
        <h2 className="text-xl font-bold uppercase text-hidrostone print:text-black">
          Medidores principais
        </h2>
      </header>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 print:grid-cols-3 print:gap-1.5">
        {masters.map(({ master, qrUrl, qrSvg }) => (
          <QrLabel
            key={master.meter.id}
            qrSvg={qrSvg}
            qrUrl={qrUrl}
            condoName={condoName}
            condoLogoUrl={condoLogoUrl}
            title={masterPrintTitle(master)}
            meterIdLine={master.meter.identifier ?? master.meter.id.slice(0, 8)}
          />
        ))}
      </div>
    </section>
  )
}

function EmptyPrint({ message }: { message: string }): React.JSX.Element {
  return (
    <div className="container max-w-3xl py-10" data-testid="print-empty-state">
      <p className="rounded-[4px] border bg-card p-4 text-sm text-muted-foreground">{message}</p>
    </div>
  )
}

function computeAvailableKinds(kinds: ReadonlyArray<GroupKind>): readonly PrintGroupKind[] {
  const present = new Set<GroupKind>(kinds)
  const available: PrintGroupKind[] = ['none']
  for (const k of ['tower', 'block', 'floor', 'villa_cluster', 'custom'] as const) {
    if (present.has(k)) available.push(k)
  }
  return available
}
