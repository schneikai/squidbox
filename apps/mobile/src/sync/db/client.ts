import { migrate } from 'drizzle-orm/expo-sqlite/migrator';
import { deleteDatabaseAsync, openDatabaseAsync } from 'expo-sqlite';

import { createDb, type AppDb } from './driver';
import { expoExecutor } from './expoExecutor';
import migrations from './migrations/migrations';
import * as schema from './schema';

let db: AppDb | null = null;

// Opens a database by name, migrated and ready to use; the caller closes it. Never touches the
// open library: that is library/current.ts, the only caller that sets the database behind getDb().
export async function openAppDb(dbName: string): Promise<AppDb> {
  const sqlite = await openDatabaseAsync(dbName);
  // Up to 64 MB of page cache (allocated on demand), so big transactions don't spill pages to the
  // journal mid-way. The default 2 MB triples the time of a large sync on web.
  await sqlite.execAsync('PRAGMA cache_size = -65536');
  const appDb = createDb(expoExecutor(sqlite), () => sqlite.closeAsync());
  try {
    // drizzle's expo migrator runs the async dialect's migrate on the db's own session, which is
    // what this sqlite-proxy db has; its signature just names the expo driver.
    await migrate(appDb as unknown as Parameters<typeof migrate>[0], migrations);
  } catch (error) {
    await appDb.close().catch(() => {});
    throw error;
  }
  return appDb;
}

// Removes a database file that nothing has open. Tolerates a missing file (iOS throws on one).
export async function deleteAppDb(dbName: string): Promise<void> {
  await deleteDatabaseAsync(dbName).catch(() => {});
}

// The open library's database (library/current.ts opens and closes it).
export function getDb(): AppDb {
  if (!db) throw new Error('No library is open (see LibraryGate in App.js).');
  return db;
}

// Called by library/current.ts only.
export function setOpenDb(next: AppDb | null): void {
  db = next;
}

export { schema };
