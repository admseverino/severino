import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'

import * as repo from '@/lib/auth-repository'
import { upsertSystemAdminUser } from '@/lib/system-admin-provisioning'
import { registerSchema } from '@/lib/validation/auth'

export const dynamic = 'force-dynamic'

const BCRYPT_ROUNDS = 12

function firstError(input: ReturnType<typeof registerSchema.safeParse>): string {
  if (input.success) return 'Dados inválidos'
  const fields = input.error.flatten().fieldErrors
  return (
    fields.confirmPassword?.[0] ??
    fields.email?.[0] ??
    fields.password?.[0] ??
    fields.name?.[0] ??
    'Dados inválidos'
  )
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body: unknown = await request.json()
    const parsed = registerSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: firstError(parsed) }, { status: 400 })
    }

    const { name, email, password } = parsed.data

    const existing = await repo.findUserByEmail(email)
    if (existing) {
      return NextResponse.json(
        { error: 'Já existe uma conta com este e-mail' },
        { status: 409 }
      )
    }

    const isFirstUser = !(await repo.hasSystemAdmin())

    if (isFirstUser) {
      // First user bootstraps as system_admin (replaces the old bootstrap-superadmin endpoint).
      await upsertSystemAdminUser({
        email,
        password,
        displayName: name,
      })
    } else {
      const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)
      await repo.createCredentialsUser({
        email,
        name,
        passwordHash,
        role: 'user',
      })
    }

    return NextResponse.json({ ok: true, bootstrap: isFirstUser })
  } catch (err) {
    console.error('register', err)
    return NextResponse.json(
      { error: 'Não foi possível criar a conta. Tente novamente.' },
      { status: 500 }
    )
  }
}
