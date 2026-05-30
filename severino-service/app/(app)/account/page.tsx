'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { User as UserIcon } from 'lucide-react'

import { PhoneVerificationForm } from '@/components/account/phone-verification-form'
import { UserMessagesPanel } from '@/components/account/user-messages-panel'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface MeResponse {
  id: string
  name: string | null
  email: string
  role: string
  image: string | null
  emailVerified: string | null
  phoneE164: string | null
  phoneVerifiedAt: string | null
  createdAt: string
}

type AccountTab = 'profile' | 'settings' | 'messages'

function parseAccountTab(value: string | null): AccountTab {
  if (value === 'settings') return 'settings'
  if (value === 'messages') return 'messages'
  return 'profile'
}

function AccountPageInner(): React.JSX.Element {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [me, setMe] = useState<MeResponse | null>(null)

  const tab = parseAccountTab(searchParams.get('tab'))

  useEffect(() => {
    if (status === 'loading') return
    if (!session?.user) {
      router.replace('/?login=1')
    }
  }, [session, status, router])

  useEffect(() => {
    if (!session?.user) return
    void (async () => {
      try {
        const res = await fetch('/api/user/me')
        if (res.ok) {
          const data: unknown = await res.json()
          setMe(data as MeResponse)
        }
      } catch {
        setMe(null)
      }
    })()
  }, [session?.user])

  if (status === 'loading' || !session?.user) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 py-4">
        <div className="h-10 w-48 animate-pulse rounded-[4px] bg-muted" />
        <div className="h-64 animate-pulse rounded-[4px] bg-muted" />
      </div>
    )
  }

  const initials =
    session.user.name
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() ||
    session.user.email?.slice(0, 2).toUpperCase() ||
    'HS'

  const memberSince = me?.createdAt
    ? new Date(me.createdAt).toLocaleDateString('pt-BR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null

  const phoneVerified = Boolean(me?.phoneVerifiedAt && me.phoneE164)

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-severinostone">Conta</h1>
        <p className="text-sm text-muted-foreground">Perfil, mensagens e configurações da sua conta.</p>
      </div>

      <Tabs
        value={tab}
        onValueChange={(next) => {
          const params = new URLSearchParams(searchParams.toString())
          if (next === 'profile') {
            params.delete('tab')
          } else {
            params.set('tab', next)
          }
          const qs = params.toString()
          router.replace(qs ? `/account?${qs}` : '/account', { scroll: false })
        }}
        className="w-full"
      >
        <TabsList>
          <TabsTrigger value="profile">Perfil</TabsTrigger>
          <TabsTrigger value="messages">Mensagens</TabsTrigger>
          <TabsTrigger value="settings">Configurações</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          <Card className="rounded-[4px]">
            <CardHeader>
              <CardTitle className="text-lg">Sua conta</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-6 sm:flex-row sm:items-start">
              <Avatar className="h-20 w-20 rounded-full border border-border">
                {session.user.image ? (
                  <AvatarImage src={session.user.image} alt={session.user.name ?? 'Usuário'} />
                ) : null}
                <AvatarFallback className="bg-quicksilver text-severinostone text-lg font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-2 flex-1">
                <p className="text-lg font-semibold">{session.user.name ?? 'Conta'}</p>
                <p className="text-sm text-muted-foreground">{session.user.email}</p>
                <Badge variant="secondary" className="uppercase">
                  {session.user.role}
                </Badge>
                {me?.phoneE164 && me.phoneVerifiedAt ? (
                  <p className="text-xs text-muted-foreground pt-1">
                    WhatsApp: {me.phoneE164}
                  </p>
                ) : null}
                {memberSince ? (
                  <p className="text-xs text-muted-foreground pt-2">Membro desde {memberSince}</p>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="messages" className="space-y-6">
          <UserMessagesPanel phoneVerified={phoneVerified} />
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <Card className="rounded-[4px]">
            <CardHeader>
              <CardTitle className="text-lg">Configurações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
                <div>
                  <span className="text-muted-foreground">Nome</span>
                  <p className="font-medium">{session.user.name ?? 'Não informado'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">E-mail</span>
                  <p className="font-medium">{session.user.email}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">E-mail verificado</span>
                  <p className="font-medium">
                    {me?.emailVerified
                      ? new Date(me.emailVerified).toLocaleDateString('pt-BR')
                      : 'Não verificado'}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Papel</span>
                  <p className="font-medium uppercase">{session.user.role}</p>
                </div>
              </div>

              <PhoneVerificationForm
                initialPhoneE164={me?.phoneE164 ?? null}
                initialPhoneVerifiedAt={me?.phoneVerifiedAt ?? null}
                onVerified={(phoneE164, phoneVerifiedAt) => {
                  setMe((current) =>
                    current
                      ? {
                          ...current,
                          phoneE164,
                          phoneVerifiedAt,
                        }
                      : current
                  )
                }}
                onRemoved={() => {
                  setMe((current) =>
                    current
                      ? {
                          ...current,
                          phoneE164: null,
                          phoneVerifiedAt: null,
                        }
                      : current
                  )
                }}
              />

              <div className="space-y-2 border-t pt-4">
                <h4 className="font-medium text-muted-foreground">Preferências</h4>
                <p className="text-sm text-muted-foreground">
                  Configurações adicionais (notificações, idioma, etc.) estarão disponíveis em breve.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function AccountFallback(): React.JSX.Element {
  return (
    <div className="mx-auto max-w-3xl py-8 text-center text-muted-foreground text-sm">
      <UserIcon className="mx-auto mb-2 size-8 opacity-50" />
      Carregando…
    </div>
  )
}

export default function AccountPage(): React.JSX.Element {
  return (
    <Suspense fallback={<AccountFallback />}>
      <AccountPageInner />
    </Suspense>
  )
}
