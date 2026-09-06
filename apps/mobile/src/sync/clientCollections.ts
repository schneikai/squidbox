import { SQLiteTable } from 'drizzle-orm/sqlite-core';
import * as schema from './db/schema';

// Client-side registry: collection name → its local SQLite table. The Inspector and full-resync
// iterate this, so albums/posts (3b) appear with no rework once added here.
export const clientCollectionTables: Record<string, SQLiteTable> = {
  assets: schema.assets,
};

export const clientCollectionNames = Object.keys(clientCollectionTables);
