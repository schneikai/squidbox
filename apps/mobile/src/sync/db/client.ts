import { openDatabaseSync } from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
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

export function getDb() {
  if (!dbInstance) dbInstance = drizzle(getSqlite(), { schema });
  return dbInstance;
}

export type ClientDb = ReturnType<typeof getDb>;
export { schema };
