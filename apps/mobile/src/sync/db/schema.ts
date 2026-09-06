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
