import { sql } from 'drizzle-orm';
import type { ContactPlace, FieldClocks, VerifyResult } from '@squidbox/shared';
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
  uniqueIndex,
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
  // The extras this account sees on top of the defaults (ACCOUNT_FEATURES); granted with
  // `npm run user:features`.
  features: text('features')
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
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
  (t) => [index('refresh_tokens_user_id_idx').on(t.userId)],
);

export type User = typeof users.$inferSelect;
export type RefreshToken = typeof refreshTokens.$inferSelect;

// The installs each account syncs from, and the build each runs (devices.ts, recorded from the
// x-squidbox-client header on every authenticated request): which builds are in use before one is
// retired (docs/sync-design.md §15). `id` is the install's own uuid; the key is per account (§2a).
export const devices = pgTable(
  'devices',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    id: uuid('id').notNull(),
    contract: integer('contract').notNull(),
    build: text('build').notNull(), // the full git sha
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.id] })],
);

// --- Syncable collections ---
// Server-only, never on the wire: each merge field's clock. NULL for a row last written before
// per-field merge, whose fields all take its updated_at (sync-design §7).
function fieldClock() {
  return jsonb('field_clock').$type<FieldClocks>();
}

// `assets` — asset metadata (sync-design §10). Composite PK (user_id, id): id is
// client-generated, so a plain-id PK would let a colliding uuid touch another tenant's row
// (§2a). server_seq is stamped by a BEFORE INSERT/UPDATE trigger (created in migrate.ts).
// Timestamps are epoch-ms numbers (client's logical clock), stored as bigint.
// id is a canonical uuid: the client mints ids (getNewItemId = uuid.v4()) and legacy rows were
// canonicalized to uuids during the one-time import (sync-design §11).
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
    fieldClock: fieldClock(),
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
    favoritedAt: bigint('favorited_at', { mode: 'number' }),
    takenAt: bigint('taken_at', { mode: 'number' }),
    originalFilename: text('original_filename'),
    latitude: doublePrecision('latitude'),
    longitude: doublePrecision('longitude'),
    tags: jsonb('tags').$type<string[]>(), // null until the assistant tagged it
    // Server-only: the last deletedAt values a restore undid; a purge of one of them loses (§7).
    restoredDeletions: jsonb('restored_deletions').$type<number[]>(),
    // Server-only, never on the wire: when the purge cleanup deleted the asset's S3 files (§7a).
    filesDeletedAt: bigint('files_deleted_at', { mode: 'number' }),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.id] }),
    index('assets_user_seq_idx').on(t.userId, t.serverSeq),
    // Purged assets whose S3 files the cleanup after a push still has to delete, in id order (sync/purgedFiles.ts).
    index('assets_purged_files_idx')
      .on(t.userId, t.id)
      .where(sql`${t.purgedAt} is not null and ${t.filesDeletedAt} is null`),
    // The assets naming a key: the purge cleanup's and the upload route's checks.
    index('assets_user_filename_idx').on(t.userId, t.filename),
    index('assets_user_thumbnail_filename_idx').on(t.userId, t.thumbnailFilename),
  ],
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
    fieldClock: fieldClock(),
  };
}

export const albums = pgTable(
  'albums',
  {
    ...syncableBase(),
    name: text('name').notNull(),
    isFavorite: boolean('is_favorite').notNull(),
    archivedAt: bigint('archived_at', { mode: 'number' }),
    favoritedAt: bigint('favorited_at', { mode: 'number' }),
    showInPostSuggestionsAfter: bigint('show_in_post_suggestions_after', { mode: 'number' }),
    oldCollectionName: text('old_collection_name'),
    notes: text('notes'),
    sortOrder: text('sort_order'),
    smartAlbumType: text('smart_album_type'),
    position: text('position'),
  },
  (t) => [primaryKey({ columns: [t.userId, t.id] }), index('albums_user_seq_idx').on(t.userId, t.serverSeq)],
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
    // A thread's following post: its first post and its place after it (null on a first post).
    threadRootId: uuid('thread_root_id'),
    threadIndex: integer('thread_index'),
  },
  (t) => [primaryKey({ columns: [t.userId, t.id] }), index('posts_user_seq_idx').on(t.userId, t.serverSeq)],
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
  (t) => [
    primaryKey({ columns: [t.userId, t.id] }),
    index('album_assets_user_seq_idx').on(t.userId, t.serverSeq),
    index('album_assets_album_idx').on(t.userId, t.albumId),
  ],
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
  (t) => [
    primaryKey({ columns: [t.userId, t.id] }),
    index('post_assets_user_seq_idx').on(t.userId, t.serverSeq),
    index('post_assets_post_idx').on(t.userId, t.postId),
  ],
);
export type PostAssetRow = typeof postAssets.$inferSelect;

// --- Assistant setup (sync-design §10) ---
// One persona per user: its id is the user's id. The lists are jsonb string arrays.
export const personas = pgTable(
  'personas',
  {
    ...syncableBase(),
    aboutYou: text('about_you').notNull(),
    contentTags: jsonb('content_tags').$type<string[]>().notNull(),
    tone: text('tone').notNull(),
    rules: jsonb('rules').$type<string[]>().notNull(),
    adultContent: boolean('adult_content').notNull().default(false),
  },
  (t) => [primaryKey({ columns: [t.userId, t.id] }), index('personas_user_seq_idx').on(t.userId, t.serverSeq)],
);
export type PersonaRow = typeof personas.$inferSelect;

export const promptButtons = pgTable(
  'prompt_buttons',
  {
    ...syncableBase(),
    name: text('name').notNull(),
    prompt: text('prompt').notNull(),
    placement: text('placement').notNull(), // 'post' | 'newPost' | 'caption' | 'refine' (validated via Zod)
    icon: text('icon'),
    position: text('position').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.id] }), index('prompt_buttons_user_seq_idx').on(t.userId, t.serverSeq)],
);
export type PromptButtonRow = typeof promptButtons.$inferSelect;

export const favorites = pgTable(
  'favorites',
  {
    ...syncableBase(),
    text: text('text').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.id] }), index('favorites_user_seq_idx').on(t.userId, t.serverSeq)],
);
export type FavoriteRow = typeof favorites.$inferSelect;

// One instructions record per user: its id is the user's id. A null text is the app's default.
export const instructions = pgTable(
  'instructions',
  {
    ...syncableBase(),
    writing: text('writing'),
    visionTagging: text('vision_tagging'),
    moreLikeThis: text('more_like_this'),
    modelCheckJudge: text('model_check_judge'),
    contactScreenshot: text('contact_screenshot'),
    contactXProfile: text('contact_x_profile'),
  },
  (t) => [primaryKey({ columns: [t.userId, t.id] }), index('instructions_user_seq_idx').on(t.userId, t.serverSeq)],
);
export type InstructionRow = typeof instructions.$inferSelect;

// One model_choices record per user: its id is the user's id. An ai_admin's picks of each kind's
// Default (`*_model`) and Uncensored default (`*_uncensored_model`), jsonb ({ id, name }); null is
// the published default (model_defaults).
export const modelChoices = pgTable(
  'model_choices',
  {
    ...syncableBase(),
    writingModel: jsonb('writing_model').$type<{ id: string; name: string }>(),
    visionModel: jsonb('vision_model').$type<{ id: string; name: string }>(),
    writingUncensoredModel: jsonb('writing_uncensored_model').$type<{ id: string; name: string }>(),
    visionUncensoredModel: jsonb('vision_uncensored_model').$type<{ id: string; name: string }>(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.id] }), index('model_choices_user_seq_idx').on(t.userId, t.serverSeq)],
);
export type ModelChoiceRow = typeof modelChoices.$inferSelect;

// --- Contacts (sync-design §10) ---
// The people the user works with, their lists, and where they are on photos, albums and posts.
// `places` is a jsonb array of `{ city, state, country }` that merges as one value.
export const contacts = pgTable(
  'contacts',
  {
    ...syncableBase(),
    name: text('name').notNull(),
    isFavorite: boolean('is_favorite').notNull(),
    favoritedAt: bigint('favorited_at', { mode: 'number' }),
    notes: text('notes'),
    xHandle: text('x_handle'),
    blueskyHandle: text('bluesky_handle'),
    onlyFansHandle: text('only_fans_handle'),
    jffHandle: text('jff_handle'),
    instagramHandle: text('instagram_handle'),
    phoneNumber: text('phone_number'),
    places: jsonb('places').$type<ContactPlace[]>().notNull(),
    avatarFilename: text('avatar_filename'),
  },
  (t) => [primaryKey({ columns: [t.userId, t.id] }), index('contacts_user_seq_idx').on(t.userId, t.serverSeq)],
);
export type ContactRow = typeof contacts.$inferSelect;

export const contactLists = pgTable(
  'contact_lists',
  {
    ...syncableBase(),
    name: text('name').notNull(),
    notes: text('notes'),
    pinnedAt: bigint('pinned_at', { mode: 'number' }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.id] }), index('contact_lists_user_seq_idx').on(t.userId, t.serverSeq)],
);
export type ContactListRow = typeof contactLists.$inferSelect;

// One contact_settings record per user: its id is the user's id. The built-in list pinned to the
// top of Contacts (`pinned_list_id`, say `tagged`) and when it was pinned.
export const contactSettings = pgTable(
  'contact_settings',
  {
    ...syncableBase(),
    pinnedListId: text('pinned_list_id'),
    pinnedAt: bigint('pinned_at', { mode: 'number' }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.id] }), index('contact_settings_user_seq_idx').on(t.userId, t.serverSeq)],
);

export const contactListMembers = pgTable(
  'contact_list_members',
  {
    ...syncableBase(),
    listId: uuid('list_id').notNull(),
    contactId: uuid('contact_id').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.id] }),
    index('contact_list_members_user_seq_idx').on(t.userId, t.serverSeq),
  ],
);
export type ContactListMemberRow = typeof contactListMembers.$inferSelect;

export const contactLinks = pgTable(
  'contact_links',
  {
    ...syncableBase(),
    contactId: uuid('contact_id').notNull(),
    targetType: text('target_type').notNull(), // 'asset' | 'album' | 'post' (validated via Zod)
    targetId: uuid('target_id').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.id] }), index('contact_links_user_seq_idx').on(t.userId, t.serverSeq)],
);
export type ContactLinkRow = typeof contactLinks.$inferSelect;

// --- Model verification (app-wide, server-owned) ---
// Facts an ai_admin sets for every account, read through the API and never synced: plain tables
// outside the collection registry (no user_id, no server_seq). sync-design §12.

// A model Squidbox verified for a kind (`kind`: writing | vision).
export const verifiedModels = pgTable(
  'verified_models',
  {
    kind: text('kind').notNull(),
    modelId: text('model_id').notNull(),
    verifiedBy: uuid('verified_by').references(() => users.id, { onDelete: 'set null' }),
    verifiedAt: timestamp('verified_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.kind, t.modelId] })],
);

// An override of Venice's Uncensored label for a model, whatever the kind (true uncensored, false
// not). No row follows Venice (catalog.ts isUncensored resolves it).
export const uncensoredOverrides = pgTable('uncensored_overrides', {
  modelId: text('model_id').primaryKey(),
  uncensored: boolean('uncensored').notNull(),
  setBy: uuid('set_by').references(() => users.id, { onDelete: 'set null' }),
  setAt: timestamp('set_at', { withTimezone: true }).notNull().defaultNow(),
});

// The model the assistant uses for a kind while the user chose none, per `variant` (regular |
// unrestricted: the persona's Adult content switch off or on). Any model of the kind: Verified is a
// flag of its own. The seed makes all four rows; nothing deletes one.
export const modelDefaults = pgTable(
  'model_defaults',
  {
    kind: text('kind').notNull(),
    variant: text('variant').notNull(),
    modelId: text('model_id').notNull(),
  },
  (t) => [primaryKey({ columns: [t.kind, t.variant] })],
);

// The instruction of a kind every account gets while it has no override (Apply changes for everyone,
// ai/instructions.ts): `kind` one of INSTRUCTION_KINDS. No row is the built-in DEFAULT_INSTRUCTIONS
// text, so a row is never stored equal to it.
export const appInstructions = pgTable('app_instructions', {
  kind: text('kind').primaryKey(),
  text: text('text').notNull(),
});

// A Verify run of a model for a kind (ai/verifyRuns.ts): only a model's latest one per kind is
// kept, and the database allows one running at a time. `result` is the VerifyResult so far.
export const verifyRuns = pgTable(
  'verify_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    kind: text('kind').notNull(),
    modelId: text('model_id').notNull(),
    status: text('status').notNull(), // 'running' | 'done' | 'stopped'
    startedBy: uuid('started_by').references(() => users.id, { onDelete: 'set null' }),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    // The heartbeat: set on each turn written, so a running row that stopped changing is abandoned.
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    turnsDone: integer('turns_done').notNull().default(0),
    turnsTotal: integer('turns_total').notNull(),
    result: jsonb('result').$type<VerifyResult>(),
    error: text('error'),
  },
  (t) => [
    uniqueIndex('verify_runs_running_idx')
      .on(t.kind, t.modelId)
      .where(sql`${t.status} = 'running'`),
    index('verify_runs_latest_idx').on(t.kind, t.modelId, t.startedAt.desc()),
  ],
);
export type VerifyRunRow = typeof verifyRuns.$inferSelect;

// Global monotonic sequence stamped onto every syncable row by a BEFORE INSERT/UPDATE trigger.
// Created here so the sequence exists before any syncable table. Raw SQL
// because Drizzle has no first-class sequence DDL we rely on across versions.
export const CREATE_CHANGE_SEQ = sql`CREATE SEQUENCE IF NOT EXISTS change_seq`;
