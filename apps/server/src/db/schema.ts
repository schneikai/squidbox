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

// Users. id is a uuid; every syncable row is scoped by it (multi-tenant sync model).
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordDigest: text('password_digest').notNull(),
  // Legacy per-user bucket for the existing account; NULL ⇒ shared bucket + per-user prefix
  // (the storage resolver decides). Users without a legacy bucket (e.g. the seeded fixture
  // user) get NULL.
  storageBucket: text('storage_bucket'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Per-device refresh tokens: each device holds its own valid token, and rotation replaces only
// the presented one. replaced_by names the successor a rotation issued at replaced_at; the rotated
// token stays usable for a short while, until that successor is first presented (auth/tokens.ts).
export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    token: text('token').notNull().unique(),
    replacedBy: text('replaced_by'),
    replacedAt: timestamp('replaced_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byUser: index('refresh_tokens_user_id_idx').on(t.userId),
  })
);

export type User = typeof users.$inferSelect;
export type RefreshToken = typeof refreshTokens.$inferSelect;

// --- Syncable collections ---
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
    purgedAt: bigint('purged_at', { mode: 'number' }), // "Delete permanently", final (sync-design §7)
    // Server-only, never on the wire: when the purge cleanup deleted the asset's S3 files (§7a).
    filesDeletedAt: bigint('files_deleted_at', { mode: 'number' }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.id] }),
    byUserSeq: index('assets_user_seq_idx').on(t.userId, t.serverSeq),
    // Purged assets whose S3 files the cleanup after a push still has to delete, in id order (sync/purgedFiles.ts).
    purgedFiles: index('assets_purged_files_idx')
      .on(t.userId, t.id)
      .where(sql`${t.purgedAt} is not null and ${t.filesDeletedAt} is null`),
    // The assets naming a key: the purge cleanup's and the upload route's checks.
    byFilename: index('assets_user_filename_idx').on(t.userId, t.filename),
    byThumbnailFilename: index('assets_user_thumbnail_filename_idx').on(t.userId, t.thumbnailFilename),
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
    position: text('position'),
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

// Global monotonic sequence stamped onto every syncable row by a BEFORE INSERT/UPDATE trigger.
// Created here so the sequence exists before any syncable table. Raw SQL
// because Drizzle has no first-class sequence DDL we rely on across versions.
export const CREATE_CHANGE_SEQ = sql`CREATE SEQUENCE IF NOT EXISTS change_seq`;
