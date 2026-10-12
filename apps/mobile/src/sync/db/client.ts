import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseAsync, openDatabaseSync } from 'expo-sqlite';
import { Platform } from 'react-native';

import * as schema from './schema';

// Lazy singleton. enableChangeListener:true is REQUIRED for useLiveQuery to react to writes
// (a silent "UI doesn't update" trap otherwise). expo-sqlite is a native module, so this file
// must only be imported from the new-sync path (which is now the app's only asset data path).
const DB_NAME = 'squidbox.db';

let sqlite: ReturnType<typeof openDatabaseSync> | null = null;
let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getSqlite() {
  if (!sqlite) sqlite = openDatabaseSync(DB_NAME, { enableChangeListener: true });
  return sqlite;
}

// Web: expo-sqlite's sync calls busy-wait only briefly for its worker (expo/expo#36392), so the very
// first one times out while the worker is still loading. Opening the database asynchronously once
// loads the worker, wasm and storage up front. A no-op on native.
export async function prepareDatabaseAsync() {
  if (Platform.OS !== 'web' || sqlite) return;
  const warmup = await openDatabaseAsync(DB_NAME);
  await warmup.closeAsync();
}

export function getDb() {
  if (!dbInstance) dbInstance = drizzle(getSqlite(), { schema });
  return dbInstance;
}

export type ClientDb = ReturnType<typeof getDb>;
export { schema };
