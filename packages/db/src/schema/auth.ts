import { sql } from 'drizzle-orm'
import {
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

export const users = pgTable(
  'users',
  {
    id: text('id')
      .primaryKey()
      .default(sql`gen_random_uuid()::text`),
    name: text('name'),
    email: text('email').notNull().unique(),
    emailVerified: timestamp('email_verified', { withTimezone: true, mode: 'date' }),
    phoneE164: text('phone_e164'),
    phoneVerifiedAt: timestamp('phone_verified_at', { withTimezone: true, mode: 'date' }),
    image: text('image'),
    password: text('password'),
    role: text('role').notNull().default('user'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('users_phone_e164_verified')
      .on(t.phoneE164)
      .where(sql`${t.phoneVerifiedAt} is not null and ${t.phoneE164} is not null`),
  ]
)

export const phoneVerificationTokens = pgTable(
  'phone_verification_tokens',
  {
    id: text('id')
      .primaryKey()
      .default(sql`gen_random_uuid()::text`),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    phoneE164: text('phone_e164'),
    codeDigest: text('code_digest').notNull(),
    tokenHash: text('token_hash').notNull(),
    expires: timestamp('expires', { withTimezone: true, mode: 'date' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    index('phone_verification_tokens_user_id').on(t.userId),
    index('phone_verification_tokens_code_digest').on(t.codeDigest),
    index('phone_verification_tokens_expires').on(t.expires),
  ]
)

export const oauthAccounts = pgTable(
  'oauth_accounts',
  {
    id: text('id')
      .primaryKey()
      .default(sql`gen_random_uuid()::text`),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (t) => [unique('oauth_accounts_provider_account_key').on(t.provider, t.providerAccountId)]
)

export const userSessions = pgTable('user_sessions', {
  id: text('id')
    .primaryKey()
    .default(sql`gen_random_uuid()::text`),
  sessionToken: text('session_token').notNull().unique(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { withTimezone: true, mode: 'date' }).notNull(),
})

export const emailVerificationTokens = pgTable(
  'email_verification_tokens',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull().unique(),
    expires: timestamp('expires', { withTimezone: true, mode: 'date' }).notNull(),
  },
  (t) => [
    primaryKey({
      columns: [t.identifier, t.token],
      name: 'email_verification_tokens_identifier_token_pk',
    }),
  ]
)
