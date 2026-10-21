import type { FieldClocks } from '@squidbox/shared';
import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, real, index, uniqueIndex } from 'drizzle-orm/sqlite-core';

// Client (SQLite) mirror of the shared asset collection descriptor. Synced fields match
// @squidbox/shared assetCollection.schema; syncError is the local-only field. Booleans are
// integers (mode:'boolean'). Local PK is `id` alone — this device only ever holds one user's data
// (the server uses composite (user_id, id)).
export const assets = sqliteTable(
  'assets',
  {
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
    // lastPostedAt is computed by the reads (assetQuery, albumQuery), not stored or synced.
    oldFileId: text('old_file_id'),
    isFileSynced: integer('is_file_synced', { mode: 'boolean' }).notNull(),
    isThumbnailSynced: integer('is_thumbnail_synced', { mode: 'boolean' }).notNull(),
    isSynced: integer('is_synced', { mode: 'boolean' }).notNull(),
    purgedAt: integer('purged_at'), // "Delete permanently", final (sync-design §7)
    // local-only (never synced)
    syncError: text('sync_error'),
    // When this device removed a purged asset's files (§7a); a trigger clears it when the purge is undone.
    filesRemovedAt: integer('files_removed_at'),
  },
  // Partial indexes for the screens' reads (docs/paged-reads-plan.md §2). A query uses one only when
  // its WHERE implies the index's, so keep the predicates in step with the queries.
  (t) => ({
    live: index('assets_live_created_idx')
      .on(t.createdAt, t.id, t.isFavorite, t.mediaType)
      .where(sql`${t.deletedAt} is null`),
    // purgedAt (always null here) keeps the Deleted reads covered by the index.
    deleted: index('assets_deleted_idx')
      .on(t.deletedAt, t.id, t.purgedAt)
      .where(sql`${t.deletedAt} is not null and ${t.purgedAt} is null`),
    unsynced: index('assets_unsynced_idx')
      .on(t.id)
      .where(sql`${t.isSynced} = 0 and ${t.deletedAt} is null and ${t.syncError} is null`),
    syncError: index('assets_sync_error_idx')
      .on(t.id)
      .where(sql`${t.syncError} is not null and ${t.deletedAt} is null`),
    notes: index('assets_notes_idx')
      .on(t.id, t.notes)
      .where(sql`${t.notes} is not null and ${t.deletedAt} is null`),
    // The purged assets whose files this device still has: the sweep's work (sweepPurgedFiles).
    purgedFiles: index('assets_purged_files_idx')
      .on(t.id)
      .where(sql`${t.purgedAt} is not null and ${t.filesRemovedAt} is null`),
  }),
);
export type AssetRow = typeof assets.$inferSelect;

// albums — mirrors @squidbox/shared albumCollection. Membership is in `album_assets` edges;
// the stats (count, cover, lastPostedAt) are computed by albumQuery. No local-only.
export const albums = sqliteTable('albums', {
  id: text('id').primaryKey(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at'),
  name: text('name').notNull(),
  isFavorite: integer('is_favorite', { mode: 'boolean' }).notNull(),
  archivedAt: integer('archived_at'),
  showInPostSuggestionsAfter: integer('show_in_post_suggestions_after'),
  oldCollectionName: text('old_collection_name'),
  notes: text('notes'),
  sortOrder: text('sort_order', { enum: ['custom'] }),
  smartAlbumType: text('smart_album_type', { enum: ['FAVORITES', 'DELETED'] }),
  position: text('position'),
});
export type AlbumRow = typeof albums.$inferSelect;

// posts — mirrors @squidbox/shared postCollection. Asset references are in `post_assets` edges.
export const posts = sqliteTable(
  'posts',
  {
    id: text('id').primaryKey(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
    deletedAt: integer('deleted_at'),
    text: text('text').notNull(),
    isFavorite: integer('is_favorite', { mode: 'boolean' }).notNull(),
    postedAt: integer('posted_at'),
    rePostId: text('re_post_id'),
    isIgnoredForRepost: integer('is_ignored_for_repost', { mode: 'boolean' }).notNull(),
    suggestRepostAt: integer('suggest_repost_at').notNull(),
    hasBeenReposted: integer('has_been_reposted', { mode: 'boolean' }).notNull(),
  },
  (t) => ({
    live: index('posts_live_posted_idx')
      .on(t.postedAt, t.id)
      .where(sql`${t.deletedAt} is null`),
  }),
);
export type PostRow = typeof posts.$inferSelect;

// Junction collections (mirror @squidbox/shared album_assets / post_assets). One row per
// membership; `position` is a fractional-index order key.
export const albumAssets = sqliteTable(
  'album_assets',
  {
    id: text('id').primaryKey(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
    deletedAt: integer('deleted_at'),
    albumId: text('album_id').notNull(),
    assetId: text('asset_id').notNull(),
    position: text('position').notNull(),
  },
  (t) => ({
    byAlbum: index('album_assets_album_position_idx')
      .on(t.albumId, t.position, t.assetId)
      .where(sql`${t.deletedAt} is null`),
    byAsset: index('album_assets_asset_idx')
      .on(t.assetId, t.albumId)
      .where(sql`${t.deletedAt} is null`),
  }),
);
export type AlbumAssetRow = typeof albumAssets.$inferSelect;

export const postAssets = sqliteTable(
  'post_assets',
  {
    id: text('id').primaryKey(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
    deletedAt: integer('deleted_at'),
    postId: text('post_id').notNull(),
    assetId: text('asset_id').notNull(),
    position: text('position').notNull(),
  },
  (t) => ({
    byPost: index('post_assets_post_idx').on(t.postId),
    byAsset: index('post_assets_asset_idx')
      .on(t.assetId, t.postId)
      .where(sql`${t.deletedAt} is null`),
  }),
);
export type PostAssetRow = typeof postAssets.$inferSelect;

// key/value store for the pull cursor + sync status (all local-only).
export const syncMeta = sqliteTable('sync_meta', {
  key: text('key').primaryKey(),
  value: text('value'),
});

// Outbox: pending local mutations to push, one row per (collection, recordId) (sync-design §6).
// `error`: why this payload failed; it waits (§6).
export const outbox = sqliteTable(
  'outbox',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    collection: text('collection').notNull(),
    recordId: text('record_id').notNull(),
    op: text('op', { enum: ['upsert', 'delete'] }).notNull(),
    payload: text('payload', { mode: 'json' }).$type<Record<string, unknown>>().notNull(),
    // changed fields → clock (sync-design §6)
    fields: text('fields', { mode: 'json' }).$type<FieldClocks>().notNull().default({}),
    // A row from before per-field merge (migration 0011): pushed without fields, as that app pushed it.
    wholeRecord: integer('whole_record', { mode: 'boolean' }).notNull().default(false),
    updatedAt: integer('updated_at').notNull(),
    createdAt: integer('created_at')
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    error: text('error'),
  },
  (t) => ({
    oneRowPerRecord: uniqueIndex('outbox_collection_record_idx').on(t.collection, t.recordId),
    failed: index('outbox_error_idx')
      .on(t.id)
      .where(sql`${t.error} is not null`),
  }),
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
