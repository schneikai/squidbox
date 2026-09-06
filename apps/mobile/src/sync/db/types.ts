import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

// The sync engine is written against this broad SQLite-dialect Drizzle type so it can run on
// EITHER expo-sqlite (device/production) OR better-sqlite3 (Node tests). Both are sync-mode
// SQLite, so the query API is identical — which is what makes the engine testable off-device.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- broad on purpose: accept any
// sync-mode SQLite Drizzle db (expo-sqlite in prod, better-sqlite3 in tests) regardless of the
// run-result and schema generics, which we don't rely on (no db.query usage).
export type SyncDb = BaseSQLiteDatabase<'sync', any, any>;
