import { getServerSession } from 'next-auth'

import { db, schema } from '@hidrosync/db'

import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function AdminHealthPage(): Promise<React.JSX.Element> {
  const session = await getServerSession(authOptions)

  let dbOk = false
  let dbMessage = 'Falha ao conectar'

  try {
    await db()
      .select({ id: schema.users.id })
      .from(schema.users)
      .limit(1)
    dbOk = true
    dbMessage = 'DB OK'
  } catch {
    dbOk = false
    dbMessage = 'Erro ao consultar o banco'
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-hidrostone">Admin / Saúde</h1>
        <p className="text-sm text-muted-foreground">Verificação básica de sessão e banco de dados.</p>
      </div>

      <div className="rounded-[4px] border bg-card p-6 space-y-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase ${
              dbOk ? 'bg-hidrogreen/15 text-hidrostone' : 'bg-destructive/10 text-destructive'
            }`}
          >
            {dbMessage}
          </span>
        </div>

        <dl className="grid grid-cols-1 gap-3 text-sm">
          <div className="flex justify-between gap-4 border-b pb-2">
            <dt className="text-muted-foreground">E-mail</dt>
            <dd className="font-medium text-right break-all">{session?.user?.email ?? '—'}</dd>
          </div>
          <div className="flex justify-between gap-4 border-b pb-2">
            <dt className="text-muted-foreground">Papel</dt>
            <dd className="font-medium text-right uppercase">{session?.user?.role ?? '—'}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">ID</dt>
            <dd className="font-mono text-xs text-right break-all">{session?.user?.id ?? '—'}</dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
