import type { FieldClocks } from '@squidbox/shared';
import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, real, index, primaryKey, uniqueIndex } from 'drizzle-orm/sqlite-core';

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
    favoritedAt: integer('favorited_at'),
    takenAt: integer('taken_at'),
    originalFilename: text('original_filename'),
    latitude: real('latitude'),
    longitude: real('longitude'),
    tags: text('tags', { mode: 'json' }).$type<string[]>(), // null until the assistant tagged it
    // local-only (never synced)
    syncError: text('sync_error'),
    // The purge (its purgedAt) this device removed the asset's files for (§7a): a later purge, after
    // one was undone, differs, so its copies are removed again.
    filesRemovedFor: integer('files_removed_for'),
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
      .where(sql`${t.purgedAt} is not null and ${t.filesRemovedFor} is not ${t.purgedAt}`),
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

// Assistant setup (mirror @squidbox/shared personas / prompt_buttons / favorites). One persona per user (its id
// is the user's id); the lists are JSON text.
export const personas = sqliteTable('personas', {
  id: text('id').primaryKey(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at'),
  aboutYou: text('about_you').notNull(),
  contentTags: text('content_tags', { mode: 'json' }).$type<string[]>().notNull(),
  tone: text('tone').notNull(),
  rules: text('rules', { mode: 'json' }).$type<string[]>().notNull(),
  adultContent: integer('adult_content', { mode: 'boolean' }).notNull().default(false),
});
export type PersonaRow = typeof personas.$inferSelect;

export const promptButtons = sqliteTable('prompt_buttons', {
  id: text('id').primaryKey(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at'),
  name: text('name').notNull(),
  prompt: text('prompt').notNull(),
  placement: text('placement', { enum: ['post', 'newPost', 'caption', 'refine'] }).notNull(),
  icon: text('icon'),
  position: text('position').notNull(),
});
export type PromptButtonRow = typeof promptButtons.$inferSelect;

// The posts the assistant writes like (mirror @squidbox/shared favorites); newest first.
export const favorites = sqliteTable('favorites', {
  id: text('id').primaryKey(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at'),
  text: text('text').notNull(),
});
export type FavoriteRow = typeof favorites.$inferSelect;

// What the assistant is told per kind (mirror @squidbox/shared instructions). One record per user (its id is the
// user's id); a null text is the app's default.
export const instructions = sqliteTable('instructions', {
  id: text('id').primaryKey(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at'),
  writing: text('writing'),
  visionTagging: text('vision_tagging'),
  moreLikeThis: text('more_like_this'),
  modelCheckJudge: text('model_check_judge'),
});
export type InstructionRow = typeof instructions.$inferSelect;

// An ai_admin's picks of each kind's Default and Uncensored default (mirror @squidbox/shared
// model_choices). One record per user (its id is the user's id); each pick is JSON text
// ({ id, name }), null the published default.
export const modelChoices = sqliteTable('model_choices', {
  id: text('id').primaryKey(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at'),
  writingModel: text('writing_model', { mode: 'json' }).$type<{ id: string; name: string }>(),
  visionModel: text('vision_model', { mode: 'json' }).$type<{ id: string; name: string }>(),
  writingUncensoredModel: text('writing_uncensored_model', { mode: 'json' }).$type<{ id: string; name: string }>(),
  visionUncensoredModel: text('vision_uncensored_model', { mode: 'json' }).$type<{ id: string; name: string }>(),
});
export type ModelChoiceRow = typeof modelChoices.$inferSelect;

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

// The model testing's memory (src/sync/aiStateRepository.ts is its only reader and writer).
// Local-only and not synced: it stays with this library on this device. `kind` is writing | vision.

// One row per kind once its list was seeded: the last compare's prompt. `chosen_model_id` is unused
// since the picks sync (model_choices).
export const aiKinds = sqliteTable('ai_kinds', {
  kind: text('kind').primaryKey(),
  chosenModelId: text('chosen_model_id'),
  prompt: text('prompt'),
});

// Your models of a kind, in the order added. `name` is kept for a model Venice no longer offers.
export const aiModels = sqliteTable(
  'ai_models',
  {
    kind: text('kind').notNull(),
    modelId: text('model_id').notNull(),
    name: text('name').notNull(),
    position: integer('position').notNull(),
    // What the admin noted about the model (null without one).
    note: text('note'),
    // Removed from the list: kept, with its note, so it comes back as it was when added again.
    isHidden: integer('is_hidden', { mode: 'boolean' }).notNull().default(false),
  },
  (t) => ({ pk: primaryKey({ columns: [t.kind, t.modelId] }) }),
);

// Each model's score of a kind (thumbs up / tags that fit), kept when it leaves your list.
export const aiScores = sqliteTable(
  'ai_scores',
  {
    kind: text('kind').notNull(),
    modelId: text('model_id').notNull(),
    score: integer('score').notNull(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.kind, t.modelId] }) }),
);

// The photos of the last vision compare, in order.
export const aiVisionPhotos = sqliteTable('ai_vision_photos', {
  assetId: text('asset_id').primaryKey(),
  position: integer('position').notNull(),
});
