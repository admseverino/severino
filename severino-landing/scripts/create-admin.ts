import readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'

import * as repo from '@/lib/auth-repository'
import { describeDatabaseUrl, getMonorepoRootDir, loadProvisioningEnv } from '@/lib/provision-env'
import { upsertSystemAdminUser } from '@/lib/system-admin-provisioning'

async function main(): Promise<void> {
  const monorepoRoot = getMonorepoRootDir(process.cwd())
  loadProvisioningEnv(monorepoRoot)

  console.log('▶ database:', describeDatabaseUrl(process.env.DATABASE_URL))

  const rl = readline.createInterface({ input, output })
  const emailRaw = await rl.question('Email do administrador: ')
  const password = await rl.question('Senha: ')
  await rl.close()

  const email = emailRaw.trim().toLowerCase()
  if (!email || !password) {
    console.error('Email e senha são obrigatórios.')
    process.exit(1)
  }

  const result = await upsertSystemAdminUser({ email, password })

  const verify = await repo.findUserByEmail(email)
  if (!verify) {
    throw new Error('Provisioning failed: user row not found after upsert (check DATABASE_URL).')
  }
  console.log(`▶ confirmed users.id=${verify.id} role=${verify.role}`)

  if (result === 'updated') {
    console.log('Usuário existente atualizado para system_admin.')
  } else {
    console.log('Administrador criado (system_admin).')
  }
}

main().catch((err: unknown) => {
  console.error(err)
  process.exit(1)
})
