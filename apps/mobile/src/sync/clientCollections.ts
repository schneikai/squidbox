import { SQLiteTable } from 'drizzle-orm/sqlite-core';
import * as schema from './db/schema';

// Client-side registry: collection name → its local SQLite table. The Inspector and full-resync
// iterate this, so every registered collection is covered with no per-collection rework.
export const clientCollectionTables: Record<string, SQLiteTable> = {
  assets: schema.assets,
  albums: schema.albums,
  posts: schema.posts,
  album_assets: schema.albumAssets,
  post_assets: schema.postAssets,
};

export const clientCollectionNames = Object.keys(clientCollectionTables);
