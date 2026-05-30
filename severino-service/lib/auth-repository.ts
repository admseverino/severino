import { and, count, desc, eq } from 'drizzle-orm'

import { db, schema } from '@severino/db'

const { users, oauthAccounts, userSessions, emailVerificationTokens } = schema

export type UserAccountRow = typeof users.$inferSelect

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export async function findUserByEmail(email: string): Promise<UserAccountRow | null> {
  const [row] = await db()
    .select()
    .from(users)
    .where(eq(users.email, normalizeEmail(email)))
    .limit(1)
  return row ?? null
}

export async function findUserById(id: string): Promise<UserAccountRow | null> {
  const [row] = await db().select().from(users).where(eq(users.id, id)).limit(1)
  return row ?? null
}

export type AdminUserListRow = Pick<
  UserAccountRow,
  'id' | 'name' | 'email' | 'role' | 'emailVerified' | 'image' | 'createdAt'
>

export async function listUsersForAdmin(): Promise<AdminUserListRow[]> {
  return db()
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      emailVerified: users.emailVerified,
      image: users.image,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt))
}

export async function countUsersWithRole(role: string): Promise<number> {
  const [row] = await db()
    .select({ n: count() })
    .from(users)
    .where(eq(users.role, role))
  return Number(row?.n ?? 0)
}

/** True when at least one user has global `system_admin` role (bootstrap UI is then disabled). */
export async function hasSystemAdmin(): Promise<boolean> {
  const [row] = await db()
    .select({ n: count() })
    .from(users)
    .where(eq(users.role, 'system_admin'))
  return Number(row?.n ?? 0) > 0
}

export async function createOAuthUser(data: {
  name?: string | null
  email: string
  emailVerified?: Date | null
  image?: string | null
}): Promise<UserAccountRow> {
  const [row] = await db()
    .insert(users)
    .values({
      email: normalizeEmail(data.email),
      name: data.name ?? null,
      emailVerified: data.emailVerified ?? null,
      image: data.image ?? null,
    })
    .returning()
  if (!row) {
    throw new Error('Failed to create user')
  }
  return row
}

/** New user with email/password (hash must already be bcrypt). Used for credentials sign-in. */
export async function createCredentialsUser(data: {
  email: string
  name?: string | null
  passwordHash: string
  role: string
}): Promise<UserAccountRow> {
  const [row] = await db()
    .insert(users)
    .values({
      email: normalizeEmail(data.email),
      name: data.name ?? null,
      password: data.passwordHash,
      role: data.role,
    })
    .returning()
  if (!row) {
    throw new Error('Failed to create user')
  }
  return row
}

export async function updateUser(
  id: string,
  patch: {
    name?: string | null
    email?: string
    emailVerified?: Date | null
    phoneE164?: string | null
    phoneVerifiedAt?: Date | null
    image?: string | null
    role?: string
    /** Bcrypt hash; use with {@link createCredentialsUser} / provisioning only. */
    password?: string | null
  }
): Promise<UserAccountRow | null> {
  const [row] = await db()
    .update(users)
    .set({
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.email !== undefined ? { email: normalizeEmail(patch.email) } : {}),
      ...(patch.emailVerified !== undefined ? { emailVerified: patch.emailVerified } : {}),
      ...(patch.phoneE164 !== undefined ? { phoneE164: patch.phoneE164 } : {}),
      ...(patch.phoneVerifiedAt !== undefined ? { phoneVerifiedAt: patch.phoneVerifiedAt } : {}),
      ...(patch.image !== undefined ? { image: patch.image } : {}),
      ...(patch.role !== undefined ? { role: patch.role } : {}),
      ...(patch.password !== undefined ? { password: patch.password } : {}),
      updatedAt: new Date(),
    })
    .where(eq(users.id, id))
    .returning()
  return row ?? null
}

export async function deleteUser(userId: string): Promise<void> {
  await db().delete(users).where(eq(users.id, userId))
}

export async function findAccountByProviderAccountId(
  provider: string,
  providerAccountId: string
): Promise<typeof oauthAccounts.$inferSelect | null> {
  const [row] = await db()
    .select()
    .from(oauthAccounts)
    .where(
      and(eq(oauthAccounts.provider, provider), eq(oauthAccounts.providerAccountId, providerAccountId))
    )
    .limit(1)
  return row ?? null
}

export async function createAccount(data: {
  userId: string
  type: string
  provider: string
  providerAccountId: string
  refresh_token?: string | null
  access_token?: string | null
  expires_at?: number | null
  token_type?: string | null
  scope?: string | null
  id_token?: string | null
  session_state?: string | null
}): Promise<typeof oauthAccounts.$inferSelect> {
  const [row] = await db()
    .insert(oauthAccounts)
    .values({
      userId: data.userId,
      type: data.type,
      provider: data.provider,
      providerAccountId: data.providerAccountId,
      refresh_token: data.refresh_token ?? null,
      access_token: data.access_token ?? null,
      expires_at: data.expires_at ?? null,
      token_type: data.token_type ?? null,
      scope: data.scope ?? null,
      id_token: data.id_token ?? null,
      session_state: data.session_state ?? null,
    })
    .returning()
  if (!row) {
    throw new Error('Failed to create OAuth account')
  }
  return row
}

export async function updateAccount(
  id: string,
  patch: {
    refresh_token?: string | null
    access_token?: string | null
    expires_at?: number | null
    token_type?: string | null
    scope?: string | null
    id_token?: string | null
    session_state?: string | null
  }
): Promise<typeof oauthAccounts.$inferSelect | null> {
  const [row] = await db().update(oauthAccounts).set(patch).where(eq(oauthAccounts.id, id)).returning()
  return row ?? null
}

export async function deleteAccountByProviderAccountId(
  provider: string,
  providerAccountId: string
): Promise<void> {
  await db()
    .delete(oauthAccounts)
    .where(
      and(eq(oauthAccounts.provider, provider), eq(oauthAccounts.providerAccountId, providerAccountId))
    )
}

export async function createSession(data: {
  sessionToken: string
  userId: string
  expires: Date
}): Promise<typeof userSessions.$inferSelect> {
  const [row] = await db()
    .insert(userSessions)
    .values({
      sessionToken: data.sessionToken,
      userId: data.userId,
      expires: data.expires,
    })
    .returning()
  if (!row) {
    throw new Error('Failed to create session')
  }
  return row
}

export async function findSessionByToken(
  sessionToken: string
): Promise<typeof userSessions.$inferSelect | null> {
  const [row] = await db()
    .select()
    .from(userSessions)
    .where(eq(userSessions.sessionToken, sessionToken))
    .limit(1)
  return row ?? null
}

export async function updateSession(
  sessionToken: string,
  patch: { expires?: Date }
): Promise<typeof userSessions.$inferSelect | null> {
  const [row] = await db()
    .update(userSessions)
    .set(patch)
    .where(eq(userSessions.sessionToken, sessionToken))
    .returning()
  return row ?? null
}

export async function deleteSession(sessionToken: string): Promise<void> {
  await db().delete(userSessions).where(eq(userSessions.sessionToken, sessionToken))
}

export async function createVerificationToken(data: {
  identifier: string
  token: string
  expires: Date
}): Promise<typeof emailVerificationTokens.$inferSelect> {
  const [row] = await db()
    .insert(emailVerificationTokens)
    .values({
      identifier: data.identifier,
      token: data.token,
      expires: data.expires,
    })
    .returning()
  if (!row) {
    throw new Error('Failed to create verification token')
  }
  return row
}

export async function useVerificationToken(data: {
  identifier: string
  token: string
}): Promise<typeof emailVerificationTokens.$inferSelect | null> {
  const [row] = await db()
    .delete(emailVerificationTokens)
    .where(
      and(
        eq(emailVerificationTokens.identifier, data.identifier),
        eq(emailVerificationTokens.token, data.token)
      )
    )
    .returning()
  return row ?? null
}
