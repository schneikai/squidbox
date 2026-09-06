import { sql } from 'drizzle-orm';
import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';

// Users. id is a uuid (was an integer in Rails; the app treats it opaquely, so this is a
// safe, forward-looking change that also matches the multi-tenant sync model where every
// syncable row is scoped by a uuid user_id).
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordDigest: text('password_digest').notNull(),
  // Legacy per-user bucket for the existing account; NULL ⇒ shared bucket + per-user prefix
  // (the storage resolver decides). New users (Phase 6 signup) get NULL.
  storageBucket: text('storage_bucket'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Per-device refresh tokens (deliberate deviation from Rails' single-slot column, so multiple
// devices can each hold a valid refresh token — the whole point of multi-device sync). The
// wire contract is unchanged: rotation replaces only the presented token.
export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    token: text('token').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byUser: index('refresh_tokens_user_id_idx').on(t.userId),
  })
);

export type User = typeof users.$inferSelect;
export type RefreshToken = typeof refreshTokens.$inferSelect;

// Global monotonic sequence stamped onto every syncable row by a BEFORE INSERT/UPDATE trigger
// (used from Phase 2). Created here so the sequence exists before any syncable table. Raw SQL
// because Drizzle has no first-class sequence DDL we rely on across versions.
export const CREATE_CHANGE_SEQ = sql`CREATE SEQUENCE IF NOT EXISTS change_seq`;
