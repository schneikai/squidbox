import type { CollectionName } from '@squidbox/shared';
import { getTableColumns } from 'drizzle-orm';

import * as schema from './db/schema';
import { localOnlyKeys } from './localOnlyKeys';

const tables = {
  assets: schema.assets,
  albums: schema.albums,
  posts: schema.posts,
  album_assets: schema.albumAssets,
  post_assets: schema.postAssets,
  personas: schema.personas,
  prompt_buttons: schema.promptButtons,
  favorites: schema.favorites,
  instructions: schema.instructions,
  model_choices: schema.modelChoices,
  contacts: schema.contacts,
  contact_lists: schema.contactLists,
  contact_list_members: schema.contactListMembers,
  contact_links: schema.contactLinks,
  contact_settings: schema.contactSettings,
  idea_settings: schema.ideaSettings,
  channels: schema.channels,
} satisfies Record<CollectionName, unknown>;

/** A collection's table: one of the registry's. */
export type CollectionTable = (typeof tables)[keyof typeof tables];

/** An edge collection's table: a junction between a parent and what it holds. */
export type EdgeTable =
  | typeof tables.album_assets
  | typeof tables.post_assets
  | typeof tables.contact_list_members
  | typeof tables.contact_links;

/** The row a collection table holds: drizzle's select model of it. */
export type RowOf<T extends CollectionTable> = T['$inferSelect'];

/** A record as a collection table inserts it: drizzle's insert model (nullable columns optional). */
export type InsertOf<T extends CollectionTable> = T['$inferInsert'];

// Client-side registry: collection name → its local SQLite table. The Inspector and full-resync
// iterate this, so every registered collection is covered with no per-collection rework. `tables`
// is keyed by the registry's names, so a registered collection without a table fails typecheck;
// this export is keyed by string because pulls and outbox rows name collections as strings.
export const clientCollectionTables: Record<string, CollectionTable> = tables;

/** Each collection and the synced columns a pull fills, by name. */
export type PulledShape = Record<string, string[]>;
let shape: PulledShape | null = null;

/**
 * What a pull fills: each collection and its synced columns, sorted. A pull restarts from the
 * beginning when it changes (status.ts pullCursor): the records pulled before were stored without the
 * new fields or collections.
 */
export function pulledShape(): PulledShape {
  shape ??= Object.fromEntries(
    Object.entries(clientCollectionTables)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, table]) => {
        const localOnly = localOnlyKeys(name);
        const columns = Object.entries(getTableColumns(table))
          .filter(([key]) => !localOnly.has(key))
          .map(([, column]) => column.name)
          .sort();
        return [name, columns];
      }),
  );
  return shape;
}
