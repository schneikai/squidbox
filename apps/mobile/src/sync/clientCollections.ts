import * as schema from './db/schema';

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
};

/** A collection's table: one of the registry's. */
export type CollectionTable = (typeof tables)[keyof typeof tables];

/** The row a collection table holds: drizzle's select model of it. */
export type RowOf<T extends CollectionTable> = T['$inferSelect'];

/** A record as a collection table inserts it: drizzle's insert model (nullable columns optional). */
export type InsertOf<T extends CollectionTable> = T['$inferInsert'];

// Client-side registry: collection name → its local SQLite table. The Inspector and full-resync
// iterate this, so every registered collection is covered with no per-collection rework.
export const clientCollectionTables: Record<string, CollectionTable> = tables;
