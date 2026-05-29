import type { NextAuthOptions } from 'next-auth'
import bcrypt from 'bcryptjs'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'

import * as repo from '@/lib/auth-repository'
import { postgresAdapter } from '@/lib/nextauth-adapter'

const providers: NextAuthOptions['providers'] = [
  CredentialsProvider({
    name: 'credentials',
    credentials: {
      email: { label: 'Email', type: 'email' },
      password: { label: 'Password', type: 'password' },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) {
        return null
      }

      const user = await repo.findUserByEmail(credentials.email)
      if (!user?.password) {
        return null
      }

      const isPasswordValid = await bcrypt.compare(credentials.password, user.password)
      if (!isPasswordValid) {
        return null
      }

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        role: user.role,
      }
    },
  }),
]

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.unshift(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    })
  )
}

export const authOptions: NextAuthOptions = {
  adapter: postgresAdapter(),
  providers,
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60,
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    async signIn({ account }) {
      if (account?.provider === 'google' || account?.provider === 'credentials') {
        return true
      }
      return false
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        if ('role' in user && typeof user.role === 'string') {
          token.role = user.role
        }
      }

      const userId =
        typeof token.id === 'string' ? token.id : typeof token.sub === 'string' ? token.sub : undefined

      if (userId) {
        const dbUser = await repo.findUserById(userId)
        if (dbUser) {
          token.role = dbUser.role ?? 'user'
        } else if (!token.role) {
          token.role = 'user'
        }
      } else if (!token.role) {
        token.role = 'user'
      }

      return token
    },
    async session({ session, token }) {
      if (session.user) {
        const userId =
          typeof token.id === 'string' && token.id.length > 0
            ? token.id
            : typeof token.sub === 'string'
              ? token.sub
              : ''
        session.user.id = userId
        session.user.role = (token.role as string) || 'user'
      }
      return session
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
}
