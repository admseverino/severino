'use client'

import { useEffect, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { signIn } from 'next-auth/react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { loginSchema, registerSchema } from '@/lib/validation/auth'

type AuthTab = 'login' | 'register'

interface AuthDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Same-origin path used after credentials success; survives reloads/RSC. */
  redirectAfterLogin: string
  /** Google provider button is only useful when env credentials are configured. */
  showGoogle: boolean
  defaultTab?: AuthTab
}

interface LoginFieldErrors {
  email?: string
  password?: string
}

interface RegisterFieldErrors {
  name?: string
  email?: string
  password?: string
  confirmPassword?: string
}

export function AuthDialog({
  open,
  onOpenChange,
  redirectAfterLogin,
  showGoogle,
  defaultTab = 'login',
}: AuthDialogProps): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<AuthTab>(defaultTab)
  const [globalError, setGlobalError] = useState<string | null>(null)
  const [globalSuccess, setGlobalSuccess] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  // Login state — controlled, so browser autofill never desyncs from React.
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [showLoginPassword, setShowLoginPassword] = useState(false)
  const [loginErrors, setLoginErrors] = useState<LoginFieldErrors>({})

  // Register state — same.
  const [regName, setRegName] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regConfirm, setRegConfirm] = useState('')
  const [showRegPassword, setShowRegPassword] = useState(false)
  const [showRegConfirm, setShowRegConfirm] = useState(false)
  const [registerErrors, setRegisterErrors] = useState<RegisterFieldErrors>({})

  useEffect(() => {
    if (open) {
      setActiveTab(defaultTab)
    }
  }, [open, defaultTab])

  const resetAll = (): void => {
    setLoginEmail('')
    setLoginPassword('')
    setShowLoginPassword(false)
    setLoginErrors({})
    setRegName('')
    setRegEmail('')
    setRegPassword('')
    setRegConfirm('')
    setShowRegPassword(false)
    setShowRegConfirm(false)
    setRegisterErrors({})
    setGlobalError(null)
    setGlobalSuccess(null)
    setSubmitting(false)
  }

  const handleOpenChange = (next: boolean): void => {
    if (!next) {
      resetAll()
    }
    onOpenChange(next)
  }

  const finishWithRedirect = (): void => {
    // Full navigation: a router transition can run before the session cookie is visible to
    // RSC, which can bounce the protected layout back to the login dialog. (Same trick the
    // reference `option-service` AuthDialog uses.)
    window.location.assign(redirectAfterLogin)
  }

  const onLogin = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setGlobalError(null)
    setGlobalSuccess(null)

    const parsed = loginSchema.safeParse({ email: loginEmail, password: loginPassword })
    if (!parsed.success) {
      const fields = parsed.error.flatten().fieldErrors
      setLoginErrors({ email: fields.email?.[0], password: fields.password?.[0] })
      return
    }
    setLoginErrors({})

    setSubmitting(true)
    try {
      const res = await signIn('credentials', {
        email: parsed.data.email,
        password: parsed.data.password,
        redirect: false,
      })
      if (res?.error) {
        setGlobalError('E-mail ou senha inválidos.')
        return
      }
      setGlobalSuccess('Login realizado com sucesso!')
      setTimeout(finishWithRedirect, 400)
    } catch {
      setGlobalError('Não foi possível entrar. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  const onRegister = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setGlobalError(null)
    setGlobalSuccess(null)

    const parsed = registerSchema.safeParse({
      name: regName,
      email: regEmail,
      password: regPassword,
      confirmPassword: regConfirm,
    })
    if (!parsed.success) {
      const fields = parsed.error.flatten().fieldErrors
      setRegisterErrors({
        name: fields.name?.[0],
        email: fields.email?.[0],
        password: fields.password?.[0],
        confirmPassword: fields.confirmPassword?.[0],
      })
      return
    }
    setRegisterErrors({})

    setSubmitting(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      })
      const payload: unknown = await res.json().catch(() => ({}))
      const apiError =
        typeof payload === 'object' && payload !== null && 'error' in payload
          ? String((payload as { error: unknown }).error)
          : null

      if (!res.ok) {
        setGlobalError(apiError ?? 'Não foi possível criar a conta.')
        return
      }

      // Auto sign-in after register so the user lands directly in the app.
      const sign = await signIn('credentials', {
        email: parsed.data.email,
        password: parsed.data.password,
        redirect: false,
      })
      if (sign?.error) {
        setGlobalSuccess('Conta criada. Use a aba Entrar para acessar.')
        setActiveTab('login')
        setLoginEmail(parsed.data.email)
        setRegName('')
        setRegEmail('')
        setRegPassword('')
        setRegConfirm('')
        return
      }
      setGlobalSuccess('Conta criada com sucesso!')
      setTimeout(finishWithRedirect, 400)
    } catch {
      setGlobalError('Não foi possível criar a conta. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  const onGoogle = async (): Promise<void> => {
    setGoogleLoading(true)
    setGlobalError(null)
    try {
      await signIn('google', { callbackUrl: redirectAfterLogin })
    } catch {
      setGlobalError('Erro ao entrar com Google.')
      setGoogleLoading(false)
    }
  }

  const isBusy = submitting || googleLoading

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {activeTab === 'login' ? 'Entrar na sua conta' : 'Criar nova conta'}
          </DialogTitle>
          <DialogDescription>
            {activeTab === 'login'
              ? 'Acesse o painel HidroSync com seu e-mail.'
              : 'Crie uma conta para acessar o painel HidroSync.'}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as AuthTab)}>
          <TabsList className="grid w-full grid-cols-2 rounded-[4px]">
            <TabsTrigger value="login" className="rounded-[4px]">
              Entrar
            </TabsTrigger>
            <TabsTrigger value="register" className="rounded-[4px]">
              Criar Conta
            </TabsTrigger>
          </TabsList>

          <TabsContent value="login" className="space-y-4">
            {globalError ? (
              <Alert variant="destructive">
                <AlertDescription>{globalError}</AlertDescription>
              </Alert>
            ) : null}
            {globalSuccess ? (
              <Alert>
                <AlertDescription>{globalSuccess}</AlertDescription>
              </Alert>
            ) : null}

            <form className="space-y-4" noValidate onSubmit={(e) => void onLogin(e)}>
              <div className="space-y-2">
                <Label htmlFor="login-email">E-mail</Label>
                <Input
                  id="login-email"
                  data-testid="login-email"
                  type="email"
                  autoComplete="email"
                  placeholder="voce@condominio.com.br"
                  className="rounded-[4px]"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  disabled={isBusy}
                />
                {loginErrors.email ? (
                  <p className="text-xs text-destructive" data-testid="login-email-error">
                    {loginErrors.email}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="login-password">Senha</Label>
                <div className="relative">
                  <Input
                    id="login-password"
                    data-testid="login-password"
                    type={showLoginPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    className="pr-10 rounded-[4px]"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    disabled={isBusy}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 rounded-[4px]"
                    onClick={() => setShowLoginPassword((p) => !p)}
                    aria-label={showLoginPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    disabled={isBusy}
                  >
                    {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                {loginErrors.password ? (
                  <p className="text-xs text-destructive" data-testid="login-password-error">
                    {loginErrors.password}
                  </p>
                ) : null}
              </div>

              <Button
                type="submit"
                data-testid="login-submit"
                className="w-full rounded-[4px] bg-hidrostone font-bold uppercase text-white hover:bg-hidrostone/90"
                disabled={isBusy}
              >
                {submitting ? 'Entrando…' : 'Entrar'}
              </Button>
            </form>

            {showGoogle ? (
              <>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <Separator className="w-full" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">Ou</span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full rounded-[4px]"
                  onClick={() => void onGoogle()}
                  disabled={isBusy}
                >
                  Entrar com Google
                </Button>
              </>
            ) : null}
          </TabsContent>

          <TabsContent value="register" className="space-y-4">
            {globalError ? (
              <Alert variant="destructive">
                <AlertDescription>{globalError}</AlertDescription>
              </Alert>
            ) : null}
            {globalSuccess ? (
              <Alert>
                <AlertDescription>{globalSuccess}</AlertDescription>
              </Alert>
            ) : null}

            <form className="space-y-4" noValidate onSubmit={(e) => void onRegister(e)}>
              <div className="space-y-2">
                <Label htmlFor="register-name">Nome completo</Label>
                <Input
                  id="register-name"
                  data-testid="register-name"
                  type="text"
                  autoComplete="name"
                  placeholder="Seu nome completo"
                  className="rounded-[4px]"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  disabled={isBusy}
                />
                {registerErrors.name ? (
                  <p className="text-xs text-destructive" data-testid="register-name-error">
                    {registerErrors.name}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="register-email">E-mail</Label>
                <Input
                  id="register-email"
                  data-testid="register-email"
                  type="email"
                  autoComplete="email"
                  placeholder="voce@condominio.com.br"
                  className="rounded-[4px]"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  disabled={isBusy}
                />
                {registerErrors.email ? (
                  <p className="text-xs text-destructive" data-testid="register-email-error">
                    {registerErrors.email}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="register-password">Senha</Label>
                <div className="relative">
                  <Input
                    id="register-password"
                    data-testid="register-password"
                    type={showRegPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Mínimo 8 caracteres"
                    className="pr-10 rounded-[4px]"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    disabled={isBusy}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 rounded-[4px]"
                    onClick={() => setShowRegPassword((p) => !p)}
                    aria-label={showRegPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    disabled={isBusy}
                  >
                    {showRegPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                {registerErrors.password ? (
                  <p className="text-xs text-destructive" data-testid="register-password-error">
                    {registerErrors.password}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="register-confirm">Confirmar senha</Label>
                <div className="relative">
                  <Input
                    id="register-confirm"
                    data-testid="register-confirm"
                    type={showRegConfirm ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Digite a senha novamente"
                    className="pr-10 rounded-[4px]"
                    value={regConfirm}
                    onChange={(e) => setRegConfirm(e.target.value)}
                    disabled={isBusy}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 rounded-[4px]"
                    onClick={() => setShowRegConfirm((p) => !p)}
                    aria-label={showRegConfirm ? 'Ocultar confirmação' : 'Mostrar confirmação'}
                    disabled={isBusy}
                  >
                    {showRegConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                {registerErrors.confirmPassword ? (
                  <p className="text-xs text-destructive" data-testid="register-confirm-error">
                    {registerErrors.confirmPassword}
                  </p>
                ) : null}
              </div>

              <Button
                type="submit"
                data-testid="register-submit"
                className="w-full rounded-[4px] bg-hidrogreen font-bold uppercase text-white hover:bg-hidrogreen/90"
                disabled={isBusy}
              >
                {submitting ? 'Criando…' : 'Criar conta'}
              </Button>
            </form>

            {showGoogle ? (
              <>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <Separator className="w-full" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">Ou</span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full rounded-[4px]"
                  onClick={() => void onGoogle()}
                  disabled={isBusy}
                >
                  Criar conta com Google
                </Button>
              </>
            ) : null}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
