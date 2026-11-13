import { getTableColumns, getTableName, sql, type SQL } from 'drizzle-orm';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import type { z } from 'zod';
import {
  type CollectionSchema,
  assetCollection,
  albumCollection,
  postCollection,
  albumAssetCollection,
  postAssetCollection,
  personaCollection,
  instructionCollection,
  modelChoiceCollection,
  promptButtonCollection,
  favoriteCollection,
  contactCollection,
  contactListCollection,
  contactListMemberCollection,
  contactLinkCollection,
  contactSettingCollection,
  ideaSettingCollection,
  type CollectionDescriptor,
  type CollectionName,
} from '@squidbox/shared';
import {
  assets,
  albums,
  posts,
  albumAssets,
  postAssets,
  personas,
  promptButtons,
  favorites,
  instructions,
  modelChoices,
  contacts,
  contactLists,
  contactListMembers,
  contactLinks,
  contactSettings,
  ideaSettings,
} from '../db/schema.js';

// Server-side view of a syncable collection: its table and shared descriptor, the columns of the
// client-facing record (`wireColumns`; the server-only ones stay out), and the push's upsert.
export interface ServerCollection {
  table: PgTable;
  descriptor: CollectionDescriptor;
  schema: CollectionSchema;
  wireColumns: Record<string, PgColumn>;
  /** The client-facing record as one json value, keys in `wireColumns` order: the pull reads every collection in one statement. */
  wireJson: SQL;
  /** A collection with a final field keeps the last deletedAt values a restore undid (sync-design §7). */
  restoredDeletions: PgColumn | undefined;
  /** The table's columns, which bound the rows per statement (Postgres takes 65,535 bind parameters). */
  columnCount: number;
  upsertSet: Record<string, SQL>;
  /** Never un-purge a row or set its updated_at back. */
  upsertGuard: SQL;
}

function serverCollection(table: PgTable, descriptor: CollectionDescriptor): ServerCollection {
  const { schema } = descriptor;
  const columns = getTableColumns(table);
  // In the schema's order, so a record reads the same whether it came from the table or a push.
  const wireColumns = Object.fromEntries(
    Object.keys(schema.shape)
      .filter((key) => key in columns)
      .map((key) => [key, columns[key]!]),
  );
  // json_build_object takes at most 100 arguments, a key and a value per column.
  if (Object.keys(wireColumns).length > 50) throw new Error(`${descriptor.name}: over 50 wire columns`);
  const wireJson = sql`json_build_object(${sql.join(
    Object.entries(wireColumns).map(([key, column]) => sql`${sql.raw(`'${key}'`)}, ${column}`),
    sql`, `,
  )})`;
  const restoredDeletions = descriptor.finalField ? columns.restoredDeletions : undefined;
  const written = { ...wireColumns, fieldClock: columns.fieldClock!, ...(restoredDeletions && { restoredDeletions }) };
  const stored = (key: string) => sql`${sql.identifier(getTableName(table))}.${sql.identifier(columns[key]!.name)}`;
  const sent = (key: string) => sql`excluded.${sql.identifier(columns[key]!.name)}`;
  const notSetBack = sql`${stored('updatedAt')} <= ${sent('updatedAt')}`;
  return {
    table,
    descriptor,
    schema,
    wireColumns,
    wireJson,
    restoredDeletions,
    columnCount: Object.keys(columns).length,
    upsertSet: Object.fromEntries(
      Object.entries(written)
        .filter(([key]) => key !== 'id')
        .map(([key]) => [key, sent(key)]),
    ),
    upsertGuard: descriptor.finalField ? sql`${stored(descriptor.finalField)} is null and ${notSetBack}` : notSetBack,
  };
}

export const serverCollections: Record<string, ServerCollection> = {
  assets: serverCollection(assets, assetCollection),
  albums: serverCollection(albums, albumCollection),
  posts: serverCollection(posts, postCollection),
  album_assets: serverCollection(albumAssets, albumAssetCollection),
  post_assets: serverCollection(postAssets, postAssetCollection),
  personas: serverCollection(personas, personaCollection),
  prompt_buttons: serverCollection(promptButtons, promptButtonCollection),
  favorites: serverCollection(favorites, favoriteCollection),
  instructions: serverCollection(instructions, instructionCollection),
  model_choices: serverCollection(modelChoices, modelChoiceCollection),
  contacts: serverCollection(contacts, contactCollection),
  contact_lists: serverCollection(contactLists, contactListCollection),
  contact_list_members: serverCollection(contactListMembers, contactListMemberCollection),
  contact_links: serverCollection(contactLinks, contactLinkCollection),
  contact_settings: serverCollection(contactSettings, contactSettingCollection),
  idea_settings: serverCollection(ideaSettings, ideaSettingCollection),
} satisfies Record<CollectionName, ServerCollection>;
