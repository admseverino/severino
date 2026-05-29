import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { authOptions } from '@/lib/auth'
import { meterIdSchema } from '@/lib/validation/meters'
import { getMeterWithContext, masterPrintTitle } from '@/modules/meters'
import { userCanAccessCondo } from '@/modules/rbac'

export const dynamic = 'force-dynamic'

interface ReadingMeterPageProps {
  params: { meterId: string }
}

export default async function ReadingMeterPage({
  params,
}: ReadingMeterPageProps): Promise<React.JSX.Element> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    redirect(`/?login=1&callbackUrl=${encodeURIComponent(`/reading/${params.meterId}`)}`)
  }

  const parsed = meterIdSchema.safeParse(params.meterId)
  if (!parsed.success) notFound()

  const context = await getMeterWithContext(parsed.data)
  if (!context) notFound()

  const allowed = await userCanAccessCondo(
    session.user.id,
    session.user.role,
    context.condo.id
  )

  if (!allowed) {
    return <ForbiddenCard condoName={context.condo.name} />
  }

  const isMaster = context.meter.kind === 'master'
  const title = isMaster
    ? masterPrintTitle({
        meter: {
          id: context.meter.id,
          kind: 'master',
          status: context.meter.status,
          identifier: context.meter.identifier,
          targetKind: context.link?.targetKind ?? 'condo',
          targetId: context.link?.targetId ?? context.condo.id,
        },
        group: context.group
          ? {
              id: context.group.id,
              name: context.group.name,
              kind: context.group.kind,
              parentGroupId: null,
            }
          : null,
        unit: context.unit ? { id: context.unit.id, label: context.unit.label, groupId: null } : null,
      })
    : `Unidade ${context.unit?.label ?? '—'}`

  const subtitle = isMaster
    ? context.condo.name
    : `${context.condo.name}${context.group ? ` · ${context.group.name}` : ''}`

  return (
    <div className="container max-w-3xl space-y-6 py-6" data-testid="reading-meter-page">
      <header className="space-y-2">
        <p
          className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          data-testid="reading-meter-condo"
        >
          {subtitle}
        </p>
        <h1 className="text-3xl font-bold text-severinostone" data-testid="reading-meter-title">
          {title}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="rounded-[4px] uppercase">
            {isMaster ? 'Medidor principal' : 'Submedidor'}
          </Badge>
          <Badge
            variant={context.meter.status === 'active' ? 'default' : 'destructive'}
            className="rounded-[4px] uppercase"
          >
            {context.meter.status === 'active' ? 'Ativo' : 'Aposentado'}
          </Badge>
          {context.meter.identifier ? (
            <Badge variant="outline" className="rounded-[4px] font-mono normal-case">
              {context.meter.identifier}
            </Badge>
          ) : null}
        </div>
      </header>

      <Card className="rounded-[4px]">
        <CardHeader>
          <CardTitle>Captura da leitura</CardTitle>
          <CardDescription>
            A captura por foto, extração via IA e o fluxo offline-first chegam no M4. Esta tela
            confirma que o QR Code apontou para o medidor correto.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Identificador do medidor:{' '}
            <span className="font-mono text-foreground" data-testid="reading-meter-id">
              {context.meter.id}
            </span>
          </p>
          <p>
            Quando a captura estiver disponível, a operadora vai chegar até aqui pelo QR Code,
            tirar a foto, validar o valor sugerido pela IA e enviar para revisão.
          </p>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="outline" className="rounded-[4px]">
          <Link href={`/meters?condo=${encodeURIComponent(context.condo.slug)}`}>
            Voltar para medidores
          </Link>
        </Button>
      </div>
    </div>
  )
}

function ForbiddenCard({ condoName }: { condoName: string }): React.JSX.Element {
  return (
    <div className="container max-w-2xl py-10" data-testid="reading-meter-forbidden">
      <Card className="rounded-[4px]">
        <CardHeader>
          <CardTitle>Sem permissão</CardTitle>
          <CardDescription>
            Você não possui concessão de papel ativa em {condoName}. Solicite acesso ao administrador
            do condomínio para abrir leituras.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline" className="rounded-[4px]">
            <Link href="/">Voltar ao início</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
