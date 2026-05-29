'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Activity, Users } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { isStaffRole } from '@/lib/admin-rbac'

export default function AdminDashboardPage(): React.JSX.Element {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'loading') return
    if (!session?.user || !isStaffRole(session.user.role)) {
      router.replace('/')
    }
  }, [session, status, router])

  if (status === 'loading') {
    return (
      <div className="container max-w-5xl py-6">
        <div className="flex h-64 items-center justify-center text-muted-foreground">Carregando…</div>
      </div>
    )
  }

  if (!session?.user || !isStaffRole(session.user.role)) {
    return <></>
  }

  return (
    <div className="container max-w-5xl space-y-6 py-6">
      <div>
        <h1 className="text-3xl font-bold text-severinostone">Administração</h1>
        <p className="mt-2 text-muted-foreground">Ferramentas internas, usuários e diagnósticos.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card
          className="cursor-pointer rounded-[4px] transition-shadow hover:shadow-md"
          onClick={() => router.push('/admin/users')}
        >
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="rounded-[4px] bg-severinogreen/15 p-3">
                <Users className="size-8 text-severinostone" />
              </div>
              <div>
                <CardTitle>Gerenciar usuários</CardTitle>
                <CardDescription>Contas, papéis e acesso</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">
              Visualize contas, atualize perfis e papéis (conforme sua permissão) e remova acessos quando
              necessário.
            </p>
            <Button
              variant="outline"
              className="w-full rounded-[4px]"
              onClick={(e) => {
                e.stopPropagation()
                router.push('/admin/users')
              }}
            >
              Abrir gestão de usuários
            </Button>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer rounded-[4px] transition-shadow hover:shadow-md"
          onClick={() => router.push('/admin/health')}
        >
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="rounded-[4px] bg-quicksilver p-3">
                <Activity className="size-8 text-severinostone" />
              </div>
              <div>
                <CardTitle>Saúde do sistema</CardTitle>
                <CardDescription>Sessão e banco de dados</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">
              Verificação básica de ambiente para suporte e diagnóstico rápido.
            </p>
            <Button
              variant="outline"
              className="w-full rounded-[4px]"
              onClick={(e) => {
                e.stopPropagation()
                router.push('/admin/health')
              }}
            >
              Abrir saúde
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
