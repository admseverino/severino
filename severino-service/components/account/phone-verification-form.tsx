'use client'

import { useEffect, useState } from 'react'

import { QrSvg } from '@/components/qr/QrSvg'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface PhoneVerificationFormProps {
  initialPhoneE164: string | null
  initialPhoneVerifiedAt: string | null
  onVerified: (phoneE164: string, phoneVerifiedAt: string) => void
}

interface VerificationChallenge {
  whatsappUrl: string
  whatsappPhoneE164: string
  qrSvg: string
  requestedAt: string
}

const POLL_INTERVAL_MS = 2000

export function PhoneVerificationForm({
  initialPhoneE164,
  initialPhoneVerifiedAt,
  onVerified,
}: PhoneVerificationFormProps): React.JSX.Element {
  const [manualPhone, setManualPhone] = useState(initialPhoneE164 ?? '')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'idle' | 'code-sent'>('idle')
  const [challenge, setChallenge] = useState<VerificationChallenge | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [manualSendMessage, setManualSendMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [verifiedPhone, setVerifiedPhone] = useState(initialPhoneE164)
  const [verifiedAt, setVerifiedAt] = useState(initialPhoneVerifiedAt)

  useEffect(() => {
    setVerifiedPhone(initialPhoneE164)
    setVerifiedAt(initialPhoneVerifiedAt)
    if (step === 'idle') {
      setManualPhone(initialPhoneE164 ?? '')
    }
  }, [initialPhoneE164, initialPhoneVerifiedAt, step])

  useEffect(() => {
    if (step !== 'code-sent') {
      return
    }

    let cancelled = false

    const pollVerification = async (): Promise<void> => {
      try {
        const res = await fetch('/api/user/me')
        if (!res.ok || cancelled) {
          return
        }

        const data: unknown = await res.json()
        const me = data as {
          phoneE164?: string | null
          phoneVerifiedAt?: string | null
        }

        const verifiedAtMs = me.phoneVerifiedAt ? Date.parse(me.phoneVerifiedAt) : NaN
        const requestedAtMs = challenge ? Date.parse(challenge.requestedAt) : NaN
        const hasNewVerification =
          Number.isFinite(verifiedAtMs) &&
          Number.isFinite(requestedAtMs) &&
          verifiedAtMs >= requestedAtMs

        if (me.phoneVerifiedAt && me.phoneE164 && hasNewVerification) {
          setVerifiedPhone(me.phoneE164)
          setVerifiedAt(me.phoneVerifiedAt)
          onVerified(me.phoneE164, me.phoneVerifiedAt)
          setStep('idle')
          setChallenge(null)
          setCode('')
          setManualSendMessage(null)
        }
      } catch {
        // Keep polling until the challenge expires or the user cancels.
      }
    }

    void pollVerification()
    const interval = window.setInterval(() => {
      void pollVerification()
    }, POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [step, onVerified, challenge])

  async function handleRequestCode(): Promise<void> {
    setError(null)
    setManualSendMessage(null)
    setLoading(true)
    try {
      const res = await fetch('/api/user/phone/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data: unknown = await res.json()
      const payload = data as {
        error?: string
        whatsappUrl?: string
        whatsappPhoneE164?: string
        qrSvg?: string
        requestedAt?: string
      }
      if (!res.ok) {
        setError(payload.error ?? 'Não foi possível iniciar a verificação.')
        return
      }

      if (payload.whatsappUrl && payload.whatsappPhoneE164 && payload.qrSvg && payload.requestedAt) {
        setChallenge({
          whatsappUrl: payload.whatsappUrl,
          whatsappPhoneE164: payload.whatsappPhoneE164,
          qrSvg: payload.qrSvg,
          requestedAt: payload.requestedAt,
        })
      }

      setStep('code-sent')
    } catch {
      setError('Não foi possível iniciar a verificação.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSendCodeToMyNumber(): Promise<void> {
    setError(null)
    setManualSendMessage(null)
    setLoading(true)
    try {
      const res = await fetch('/api/user/phone/manual-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: manualPhone }),
      })
      const data: unknown = await res.json()
      const payload = data as {
        error?: string
        phoneE164?: string
        requestedAt?: string
      }
      if (!res.ok) {
        setError(payload.error ?? 'Não foi possível enviar o código para seu WhatsApp.')
        return
      }

      if (payload.requestedAt && challenge) {
        setChallenge({ ...challenge, requestedAt: payload.requestedAt })
      }

      setManualSendMessage(
        payload.phoneE164
          ? `Código enviado para ${payload.phoneE164}.`
          : 'Código enviado para seu WhatsApp.'
      )
    } catch {
      setError('Não foi possível enviar o código para seu WhatsApp.')
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyCode(): Promise<void> {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/user/phone/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: manualPhone || undefined, code }),
      })
      const data: unknown = await res.json()
      const payload = data as {
        error?: string
        phoneE164?: string
        phoneVerifiedAt?: string
      }
      if (!res.ok) {
        setError(payload.error ?? 'Não foi possível verificar o telefone.')
        return
      }
      if (payload.phoneE164 && payload.phoneVerifiedAt) {
        setVerifiedPhone(payload.phoneE164)
        setVerifiedAt(payload.phoneVerifiedAt)
        onVerified(payload.phoneE164, payload.phoneVerifiedAt)
      }
      setStep('idle')
      setCode('')
      setChallenge(null)
      setManualSendMessage(null)
    } catch {
      setError('Não foi possível verificar o telefone.')
    } finally {
      setLoading(false)
    }
  }

  function handleCancel(): void {
    setStep('idle')
    setCode('')
    setChallenge(null)
    setError(null)
    setManualSendMessage(null)
  }

  return (
    <div className="space-y-4 border-t pt-4">
      <div>
        <h4 className="font-medium">Telefone WhatsApp</h4>
        <p className="text-sm text-muted-foreground">
          Vincule seu número para receber mensagens enviadas ao Severino na aba Mensagens.
        </p>
      </div>

      {verifiedPhone && verifiedAt ? (
        <div
          className="rounded-[4px] border border-border bg-muted/40 p-3 text-sm"
          data-testid="phone-verified-banner"
        >
          <p>
            <span className="text-muted-foreground">Verificado:</span>{' '}
            <span className="font-medium">{verifiedPhone}</span>
          </p>
          <p className="text-xs text-muted-foreground pt-1">
            Desde {new Date(verifiedAt).toLocaleDateString('pt-BR')}
          </p>
        </div>
      ) : null}

      {step === 'code-sent' && challenge ? (
        <div
          className="space-y-4 rounded-[4px] border border-border bg-muted/20 p-4"
          data-testid="phone-verification-qr"
        >
          <div>
            <p className="font-medium">Escaneie este QR code</p>
            <p className="text-sm text-muted-foreground">
              Envie para <span className="font-medium">{challenge.whatsappPhoneE164}</span> a
              mensagem com o código gerado usando o WhatsApp do número que você quer verificar.
            </p>
          </div>

          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <QrSvg
              svg={challenge.qrSvg}
              alt="QR code para verificar telefone no WhatsApp"
              className="h-40 w-40 rounded-[4px] border border-border bg-white p-2"
            />
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                O QR code já inclui a mensagem pronta para envio. Assim que recebermos a mensagem,
                a verificação será concluída automaticamente.
              </p>
              <Button asChild variant="outline" type="button">
                <a href={challenge.whatsappUrl} target="_blank" rel="noopener noreferrer">
                  Abrir no WhatsApp
                </a>
              </Button>
              <p className="text-xs text-muted-foreground">Aguardando confirmação…</p>
            </div>
          </div>
        </div>
      ) : null}

      {step === 'code-sent' ? (
        <details className="rounded-[4px] border border-border p-3 text-sm">
          <summary className="cursor-pointer font-medium">Inserir código manualmente</summary>
          <div className="mt-3 grid gap-2">
            <Label htmlFor="phone-manual">Seu número</Label>
            <Input
              id="phone-manual"
              type="tel"
              autoComplete="tel"
              placeholder="(11) 98765-4321"
              value={manualPhone}
              onChange={(event) => setManualPhone(event.target.value)}
            />
            <Button
              type="button"
              variant="outline"
              disabled={loading || manualPhone.trim().length < 8}
              onClick={() => void handleSendCodeToMyNumber()}
            >
              {loading ? 'Enviando…' : 'Enviar código para meu WhatsApp'}
            </Button>
            {manualSendMessage ? (
              <p className="text-xs text-muted-foreground">{manualSendMessage}</p>
            ) : null}
            <Label htmlFor="phone-code">Código de verificação</Label>
            <Input
              id="phone-code"
              data-testid="phone-code-input"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
            />
            <Button
              type="button"
              data-testid="phone-verify-code"
              disabled={loading || code.length !== 6}
              onClick={() => void handleVerifyCode()}
            >
              {loading ? 'Verificando…' : 'Confirmar código'}
            </Button>
          </div>
        </details>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        {step === 'idle' ? (
          <Button
            type="button"
            data-testid="phone-request-code"
            disabled={loading}
            onClick={() => void handleRequestCode()}
          >
            {loading ? 'Gerando…' : verifiedPhone ? 'Alterar telefone' : 'Enviar código'}
          </Button>
        ) : (
          <Button type="button" variant="outline" disabled={loading} onClick={handleCancel}>
            Cancelar
          </Button>
        )}
      </div>
    </div>
  )
}
