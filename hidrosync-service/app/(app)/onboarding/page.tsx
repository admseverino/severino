import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import { isStaffRole } from '@/lib/admin-rbac'

import { OnboardingClient } from './OnboardingClient'

export const dynamic = 'force-dynamic'

export default async function OnboardingPage(): Promise<React.JSX.Element> {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect('/?login=1')
  }
  if (!isStaffRole(session.user.role)) {
    redirect('/')
  }

  return (
    <div className="container max-w-5xl space-y-6 py-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-hidrostone">Configuração das Unidades</h1>
        <p className="text-muted-foreground">
          Descreva a estrutura do condomínio em texto livre. Geramos uma prévia dos grupos e unidades; nada é gravado até você confirmar.
        </p>
      </header>
      <OnboardingClient />
    </div>
  )
}
