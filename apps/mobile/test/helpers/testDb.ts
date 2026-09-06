import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from '../../src/sync/db/schema';
import type { SyncDb } from '../../src/sync/db/types';

// An in-memory SQLite "device" for tests: better-sqlite3 + the SAME Drizzle schema and the SAME
// generated migrations the app ships. Same SQLite dialect as expo-sqlite, so it exercises the
// real upserts/outbox/transactions off-device.
const migrationsFolder = fileURLToPath(new URL('../../src/sync/db/migrations', import.meta.url));

export function makeTestDb(): SyncDb {
  const sqlite = new Database(':memory:');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder });
  return db as unknown as SyncDb;
}
