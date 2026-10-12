import { openDatabaseAsync } from 'expo-sqlite';

import { createDb, type AppDb } from './driver';
import { expoExecutor } from './expoExecutor';
import * as schema from './schema';

const DB_NAME = 'squidbox.db';

let db: AppDb | null = null;
let opening: Promise<AppDb> | null = null;

// Opened once at launch (DatabaseGate in App.js), before anything reads or writes.
export function openDatabase(): Promise<AppDb> {
  opening ??= openDatabaseAsync(DB_NAME).then((sqlite) => (db = createDb(expoExecutor(sqlite))));
  return opening;
}

export function getDb(): AppDb {
  if (!db) throw new Error('The database is not open yet (see DatabaseGate in App.js).');
  return db;
}

export { schema };
