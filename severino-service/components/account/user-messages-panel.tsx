'use client'

import { useEffect, useState } from 'react'
import { MessageSquare } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface UserMessageItem {
  id: string
  textBody: string | null
  waTimestamp: string
  createdAt: string
}

interface UserMessagesPanelProps {
  phoneVerified: boolean
}

export function UserMessagesPanel({ phoneVerified }: UserMessagesPanelProps): React.JSX.Element {
  const [messages, setMessages] = useState<UserMessageItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/user/messages')
        if (!res.ok) {
          setError('Não foi possível carregar suas mensagens.')
          setMessages([])
          return
        }
        const data: unknown = await res.json()
        const payload = data as { messages?: UserMessageItem[] }
        setMessages(Array.isArray(payload.messages) ? payload.messages : [])
      } catch {
        setError('Não foi possível carregar suas mensagens.')
        setMessages([])
      } finally {
        setLoading(false)
      }
    })()
  }, [phoneVerified])

  if (!phoneVerified) {
    return (
      <Card className="rounded-[4px]">
        <CardHeader>
          <CardTitle className="text-lg">Mensagens</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Verifique seu telefone em Configurações para ver mensagens enviadas pelo WhatsApp.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="rounded-[4px]" data-testid="account-messages-panel">
      <CardHeader>
        <CardTitle className="text-lg">Mensagens</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="h-24 animate-pulse rounded-[4px] bg-muted" />
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : messages.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            <MessageSquare className="mx-auto mb-2 size-8 opacity-50" />
            Nenhuma mensagem recebida ainda.
          </div>
        ) : (
          <ul className="space-y-3">
            {messages.map((message) => (
              <li
                key={message.id}
                className="rounded-[4px] border border-border bg-muted/30 p-3"
                data-testid="user-message-item"
              >
                <p className="text-sm whitespace-pre-wrap">
                  {message.textBody ?? '(mensagem sem texto)'}
                </p>
                <p className="text-xs text-muted-foreground pt-2">
                  {new Date(message.waTimestamp).toLocaleString('pt-BR')}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
