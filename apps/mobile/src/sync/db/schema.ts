import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, real, uniqueIndex } from 'drizzle-orm/sqlite-core';

// Client (SQLite) mirror of the shared asset collection descriptor. Synced fields match
// @squidbox/shared assetCollection.schema; syncError is the local-only field. Booleans are
// integers (mode:'boolean'); postHistory is JSON text. Local PK is `id` alone — this device
// only ever holds one user's data (the server uses composite (user_id, id)).
export const assets = sqliteTable('assets', {
  id: text('id').primaryKey(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at'),
  mediaLibraryAssetId: text('media_library_asset_id').notNull(),
  mediaType: text('media_type', { enum: ['photo', 'video'] }).notNull(),
  width: integer('width').notNull(),
  height: integer('height').notNull(),
  fileSize: integer('file_size').notNull(),
  duration: real('duration'),
  filename: text('filename').notNull(),
  thumbnailFilename: text('thumbnail_filename').notNull(),
  isFavorite: integer('is_favorite', { mode: 'boolean' }).notNull(),
  notes: text('notes'),
  postHistory: text('post_history', { mode: 'json' }).$type<string[]>().notNull(),
  lastPostedAt: integer('last_posted_at'),
  oldFileId: text('old_file_id'),
  isFileSynced: integer('is_file_synced', { mode: 'boolean' }).notNull(),
  isThumbnailSynced: integer('is_thumbnail_synced', { mode: 'boolean' }).notNull(),
  isSynced: integer('is_synced', { mode: 'boolean' }).notNull(),
  // local-only (never synced)
  syncError: text('sync_error'),
});
export type AssetRow = typeof assets.$inferSelect;

// albums — mirrors @squidbox/shared albumCollection. Ordered `assets` is JSON. No local-only.
export const albums = sqliteTable('albums', {
  id: text('id').primaryKey(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at'),
  name: text('name').notNull(),
  assets: text('assets', { mode: 'json' }).$type<string[]>().notNull(),
  isFavorite: integer('is_favorite', { mode: 'boolean' }).notNull(),
  archivedAt: integer('archived_at'),
  postHistory: text('post_history', { mode: 'json' }).$type<string[]>().notNull(),
  lastPostedAt: integer('last_posted_at'),
  showInPostSuggestionsAfter: integer('show_in_post_suggestions_after'),
  oldCollectionName: text('old_collection_name'),
  notes: text('notes'),
  sortOrder: text('sort_order', { enum: ['custom'] }),
  smartAlbumType: text('smart_album_type', { enum: ['FAVORITES', 'DELETED'] }),
});
export type AlbumRow = typeof albums.$inferSelect;

// posts — mirrors @squidbox/shared postCollection. Ordered `assetRefs` is JSON. No local-only.
export const posts = sqliteTable('posts', {
  id: text('id').primaryKey(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at'),
  text: text('text').notNull(),
  assetRefs: text('asset_refs', { mode: 'json' }).$type<{ id: string; assetId: string }[]>().notNull(),
  isFavorite: integer('is_favorite', { mode: 'boolean' }).notNull(),
  postedAt: integer('posted_at'),
  rePostId: text('re_post_id'),
  isIgnoredForRepost: integer('is_ignored_for_repost', { mode: 'boolean' }).notNull(),
  suggestRepostAt: integer('suggest_repost_at').notNull(),
  hasBeenReposted: integer('has_been_reposted', { mode: 'boolean' }).notNull(),
});
export type PostRow = typeof posts.$inferSelect;

// key/value store for the pull cursor + sync status (all local-only).
export const syncMeta = sqliteTable('sync_meta', {
  key: text('key').primaryKey(),
  value: text('value'),
});

// Outbox: pending local mutations to push. Coalesced to one row per (collection, recordId)
// — the latest whole-record payload wins (sync-design §6).
export const outbox = sqliteTable(
  'outbox',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    collection: text('collection').notNull(),
    recordId: text('record_id').notNull(),
    op: text('op', { enum: ['upsert', 'delete'] }).notNull(),
    payload: text('payload', { mode: 'json' }).$type<Record<string, unknown>>().notNull(),
    updatedAt: integer('updated_at').notNull(),
    createdAt: integer('created_at')
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({ oneRowPerRecord: uniqueIndex('outbox_collection_record_idx').on(t.collection, t.recordId) })
);
export type OutboxRow = typeof outbox.$inferSelect;

// Ring-buffer of recent sync runs (last ~100) for the Inspector: counts, duration, errors, and
// conflict/rebase notes (e.g. "assets <id>: local change overwritten by server"). Local-only.
export const syncLog = sqliteTable('sync_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  ranAt: integer('ran_at').notNull(),
  pushed: integer('pushed').notNull().default(0),
  pulled: integer('pulled').notNull().default(0),
  durationMs: integer('duration_ms').notNull().default(0),
  error: text('error'),
  notes: text('notes'),
});
export type SyncLogRow = typeof syncLog.$inferSelect;
