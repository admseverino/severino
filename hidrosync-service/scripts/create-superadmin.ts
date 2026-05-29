import path from 'node:path'
import { fileURLToPath } from 'node:url'

import * as repo from '@/lib/auth-repository'
import { describeDatabaseUrl, getMonorepoRootDir, loadProvisioningEnv } from '@/lib/provision-env'
import { upsertSystemAdminUser } from '@/lib/system-admin-provisioning'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function getSuperadminCredentials(): { email: string; password: string } {
  const emailRaw =
    process.env.superadminuser ??
    process.env.SUPERADMINUSER ??
    process.env.SUPERADMIN_USER
  const password =
    process.env.superadminpass ??
    process.env.SUPERADMINPASS ??
    process.env.SUPERADMIN_PASS

  const email = emailRaw?.trim().toLowerCase() ?? ''
  if (!email || !password) {
    console.error(
      'Missing credentials: set superadminuser and superadminpass (or SUPERADMINUSER / SUPERADMINPASS) in the environment or repo-root .env.'
    )
    process.exit(1)
  }
  return { email, password }
}

async function main(): Promise<void> {
  const monorepoRoot = getMonorepoRootDir(path.join(__dirname, '..', '..'))
  loadProvisioningEnv(monorepoRoot)

  console.log('▶ database:', describeDatabaseUrl(process.env.DATABASE_URL))

  const { email, password } = getSuperadminCredentials()
  const result = await upsertSystemAdminUser({ email, password })

  const verify = await repo.findUserByEmail(email)
  if (!verify) {
    throw new Error('Provisioning failed: user row not found after upsert (check DATABASE_URL).')
  }
  console.log(`▶ confirmed users.id=${verify.id} role=${verify.role}`)

  if (result === 'updated') {
    console.log('Usuário existente atualizado para system_admin.')
  } else {
    console.log('Superadmin criado (system_admin).')
  }
}

main().catch((err: unknown) => {
  console.error(err)
  process.exit(1)
})
