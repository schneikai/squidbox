import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
  bigint,
  integer,
  boolean,
  jsonb,
  doublePrecision,
  primaryKey,
} from 'drizzle-orm/pg-core';

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

// --- Syncable collections (Phase 2+) ---
// `assets` — asset metadata (sync-design §10). Composite PK (user_id, id): id is
// client-generated, so a plain-id PK would let a colliding uuid touch another tenant's row
// (§2a). server_seq is stamped by a BEFORE INSERT/UPDATE trigger (created in migrate.ts).
// Timestamps are epoch-ms numbers (client's logical clock), stored as bigint.
// id is a canonical uuid: the client mints ids (getNewItemId = uuid.v4()) and legacy rows were
// canonicalized to uuids during the one-time import (convert/remap.ts).
export const assets = pgTable(
  'assets',
  {
    id: uuid('id').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: bigint('created_at', { mode: 'number' }).notNull(),
    updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
    deletedAt: bigint('deleted_at', { mode: 'number' }),
    serverSeq: bigint('server_seq', { mode: 'number' }), // set by trigger
    mediaLibraryAssetId: text('media_library_asset_id').notNull(),
    mediaType: text('media_type').notNull(), // 'photo' | 'video' (validated via Zod)
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    fileSize: bigint('file_size', { mode: 'number' }).notNull(),
    duration: doublePrecision('duration'),
    filename: text('filename').notNull(),
    thumbnailFilename: text('thumbnail_filename').notNull(),
    isFavorite: boolean('is_favorite').notNull(),
    notes: text('notes'),
    oldFileId: text('old_file_id'),
    isFileSynced: boolean('is_file_synced').notNull(),
    isThumbnailSynced: boolean('is_thumbnail_synced').notNull(),
    isSynced: boolean('is_synced').notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.id] }),
    byUserSeq: index('assets_user_seq_idx').on(t.userId, t.serverSeq),
  })
);

export type AssetRow = typeof assets.$inferSelect;

// Shared base columns for a syncable table (composite PK + server_seq trigger applied in
// migrate.ts; timestamps are epoch-ms bigints).
function syncableBase() {
  return {
    id: uuid('id').notNull(), // canonical uuid (see assets.id note)
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: bigint('created_at', { mode: 'number' }).notNull(),
    updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
    deletedAt: bigint('deleted_at', { mode: 'number' }),
    serverSeq: bigint('server_seq', { mode: 'number' }),
  };
}

export const albums = pgTable(
  'albums',
  {
    ...syncableBase(),
    name: text('name').notNull(),
    isFavorite: boolean('is_favorite').notNull(),
    archivedAt: bigint('archived_at', { mode: 'number' }),
    showInPostSuggestionsAfter: bigint('show_in_post_suggestions_after', { mode: 'number' }),
    oldCollectionName: text('old_collection_name'),
    notes: text('notes'),
    sortOrder: text('sort_order'),
    smartAlbumType: text('smart_album_type'),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.id] }),
    byUserSeq: index('albums_user_seq_idx').on(t.userId, t.serverSeq),
  })
);
export type AlbumRow = typeof albums.$inferSelect;

export const posts = pgTable(
  'posts',
  {
    ...syncableBase(),
    text: text('text').notNull(),
    isFavorite: boolean('is_favorite').notNull(),
    postedAt: bigint('posted_at', { mode: 'number' }),
    rePostId: text('re_post_id'),
    isIgnoredForRepost: boolean('is_ignored_for_repost').notNull(),
    suggestRepostAt: bigint('suggest_repost_at', { mode: 'number' }).notNull(),
    hasBeenReposted: boolean('has_been_reposted').notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.id] }),
    byUserSeq: index('posts_user_seq_idx').on(t.userId, t.serverSeq),
  })
);
export type PostRow = typeof posts.$inferSelect;

// --- Junction collections (membership as first-class syncable edges) ---
// One row per (album, asset) / (post, asset). `position` is a fractional-index order key. Same
// syncableBase (composite PK + server_seq trigger) as every other collection, so add/remove/reorder
// ride the existing LWW engine as independent edge writes. byParent index powers the read path.
export const albumAssets = pgTable(
  'album_assets',
  {
    ...syncableBase(),
    albumId: uuid('album_id').notNull(),
    assetId: uuid('asset_id').notNull(),
    position: text('position').notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.id] }),
    byUserSeq: index('album_assets_user_seq_idx').on(t.userId, t.serverSeq),
    byAlbum: index('album_assets_album_idx').on(t.userId, t.albumId),
  })
);
export type AlbumAssetRow = typeof albumAssets.$inferSelect;

export const postAssets = pgTable(
  'post_assets',
  {
    ...syncableBase(),
    postId: uuid('post_id').notNull(),
    assetId: uuid('asset_id').notNull(),
    position: text('position').notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.id] }),
    byUserSeq: index('post_assets_user_seq_idx').on(t.userId, t.serverSeq),
    byPost: index('post_assets_post_idx').on(t.userId, t.postId),
  })
);
export type PostAssetRow = typeof postAssets.$inferSelect;

// Global monotonic sequence stamped onto every syncable row by a BEFORE INSERT/UPDATE trigger
// (used from Phase 2). Created here so the sequence exists before any syncable table. Raw SQL
// because Drizzle has no first-class sequence DDL we rely on across versions.
export const CREATE_CHANGE_SEQ = sql`CREATE SEQUENCE IF NOT EXISTS change_seq`;
