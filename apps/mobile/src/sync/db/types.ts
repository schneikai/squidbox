import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

// The sync engine is written against this broad async SQLite type, so the same code runs on the
// app's database (expo-sqlite) and the tests' (better-sqlite3), both created by createDb (driver.ts).
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the engine doesn't rely on the
// run-result or schema generics (no db.query usage).
export type SyncDb = BaseSQLiteDatabase<'async', any, any>;
