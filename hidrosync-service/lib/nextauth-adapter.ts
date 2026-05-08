import type { Adapter, AdapterAccount, AdapterSession, AdapterUser, VerificationToken } from 'next-auth/adapters'

import type { UserAccountRow } from '@/lib/auth-repository'
import * as repo from '@/lib/auth-repository'

function mapUserForAdapter(user: UserAccountRow): AdapterUser & { role: string } {
  return {
    id: user.id,
    name: user.name ?? null,
    email: user.email,
    emailVerified: user.emailVerified ?? null,
    image: user.image ?? null,
    role: user.role || 'user',
  }
}

export function postgresAdapter(): Adapter {
  return {
    async createUser(user: Omit<AdapterUser, 'id'>) {
      const existingUser = user.email ? await repo.findUserByEmail(user.email) : null
      if (existingUser) {
        return mapUserForAdapter(existingUser)
      }

      const dbUser = await repo.createOAuthUser({
        name: user.name,
        email: user.email!,
        emailVerified: user.emailVerified,
        image: user.image,
      })

      return mapUserForAdapter(dbUser)
    },

    async getUser(id: string) {
      const user = await repo.findUserById(id)
      if (!user) return null
      return mapUserForAdapter(user)
    },

    async getUserByEmail(email: string) {
      const user = await repo.findUserByEmail(email)
      if (!user) return null
      return mapUserForAdapter(user)
    },

    async getUserByAccount({ providerAccountId, provider }: Pick<AdapterAccount, 'provider' | 'providerAccountId'>) {
      const account = await repo.findAccountByProviderAccountId(provider, providerAccountId)
      if (!account) return null

      const user = await repo.findUserById(account.userId)
      if (!user) return null

      return mapUserForAdapter(user)
    },

    async updateUser(user: Partial<AdapterUser> & Pick<AdapterUser, 'id'>) {
      const role = 'role' in user && typeof user.role === 'string' ? user.role : undefined
      const dbUser = await repo.updateUser(user.id, {
        ...(user.name !== undefined ? { name: user.name } : {}),
        ...(user.email !== undefined ? { email: user.email } : {}),
        ...(user.emailVerified !== undefined ? { emailVerified: user.emailVerified } : {}),
        ...(user.image !== undefined ? { image: user.image } : {}),
        ...(role !== undefined ? { role } : {}),
      })

      if (!dbUser) {
        throw new Error('User not found')
      }

      return mapUserForAdapter(dbUser)
    },

    async deleteUser(userId: string) {
      await repo.deleteUser(userId)
    },

    async linkAccount(account: AdapterAccount) {
      const existingAccount = await repo.findAccountByProviderAccountId(
        account.provider,
        account.providerAccountId
      )

      if (existingAccount) {
        const updatedAccount = await repo.updateAccount(existingAccount.id, {
          refresh_token: account.refresh_token ?? null,
          access_token: account.access_token ?? null,
          expires_at: account.expires_at ?? null,
          token_type: account.token_type ?? null,
          scope: account.scope ?? null,
          id_token: account.id_token ?? null,
          session_state: account.session_state ?? null,
        })

        if (!updatedAccount) {
          throw new Error('Failed to update OAuth account')
        }

        return {
          id: updatedAccount.id,
          userId: updatedAccount.userId,
          type: updatedAccount.type,
          provider: updatedAccount.provider,
          providerAccountId: updatedAccount.providerAccountId,
          refresh_token: updatedAccount.refresh_token,
          access_token: updatedAccount.access_token,
          expires_at: updatedAccount.expires_at,
          token_type: updatedAccount.token_type,
          scope: updatedAccount.scope,
          id_token: updatedAccount.id_token,
          session_state: updatedAccount.session_state,
        }
      }

      const dbAccount = await repo.createAccount({
        userId: account.userId,
        type: account.type,
        provider: account.provider,
        providerAccountId: account.providerAccountId,
        refresh_token: account.refresh_token ?? null,
        access_token: account.access_token ?? null,
        expires_at: account.expires_at ?? null,
        token_type: account.token_type ?? null,
        scope: account.scope ?? null,
        id_token: account.id_token ?? null,
        session_state: account.session_state ?? null,
      })

      return {
        id: dbAccount.id,
        userId: dbAccount.userId,
        type: dbAccount.type,
        provider: dbAccount.provider,
        providerAccountId: dbAccount.providerAccountId,
        refresh_token: dbAccount.refresh_token,
        access_token: dbAccount.access_token,
        expires_at: dbAccount.expires_at,
        token_type: dbAccount.token_type,
        scope: dbAccount.scope,
        id_token: dbAccount.id_token,
        session_state: dbAccount.session_state,
      }
    },

    async unlinkAccount({ providerAccountId, provider }: Pick<AdapterAccount, 'provider' | 'providerAccountId'>) {
      await repo.deleteAccountByProviderAccountId(provider, providerAccountId)
    },

    async createSession({ sessionToken, userId, expires }: { sessionToken: string; userId: string; expires: Date }) {
      const dbSession = await repo.createSession({ sessionToken, userId, expires })

      return {
        id: dbSession.id,
        sessionToken: dbSession.sessionToken,
        userId: dbSession.userId,
        expires: dbSession.expires,
      }
    },

    async getSessionAndUser(sessionToken: string) {
      const session = await repo.findSessionByToken(sessionToken)
      if (!session) return null

      const user = await repo.findUserById(session.userId)
      if (!user) return null

      return {
        session: {
          id: session.id,
          sessionToken: session.sessionToken,
          userId: session.userId,
          expires: session.expires,
        },
        user: mapUserForAdapter(user),
      }
    },

    async updateSession({ sessionToken, expires }: { sessionToken: string; expires?: Date }) {
      const dbSession = await repo.updateSession(sessionToken, expires !== undefined ? { expires } : {})
      if (!dbSession) return null

      return {
        id: dbSession.id,
        sessionToken: dbSession.sessionToken,
        userId: dbSession.userId,
        expires: dbSession.expires,
      }
    },

    async deleteSession(sessionToken: string) {
      await repo.deleteSession(sessionToken)
    },

    async createVerificationToken({ identifier, expires, token }: VerificationToken) {
      const dbToken = await repo.createVerificationToken({ identifier, token, expires })

      return {
        identifier: dbToken.identifier,
        token: dbToken.token,
        expires: dbToken.expires,
      }
    },

    async useVerificationToken({ identifier, token }: { identifier: string; token: string }) {
      const dbToken = await repo.useVerificationToken({ identifier, token })
      if (!dbToken) return null

      return {
        identifier: dbToken.identifier,
        token: dbToken.token,
        expires: dbToken.expires,
      }
    },
  }
}
