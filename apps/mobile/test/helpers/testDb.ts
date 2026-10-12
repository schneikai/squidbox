import Database from 'better-sqlite3';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { fileURLToPath } from 'node:url';

import { createDb, type AppDb, type Execute } from '../../src/sync/db/driver';

// An in-memory SQLite "device" for tests: better-sqlite3 behind the app's own driver (createDb, so
// the same queue and transactions), with the same generated migrations the app ships.
const migrationsFolder = fileURLToPath(new URL('../../src/sync/db/migrations', import.meta.url));

export function makeTestDb(): AppDb {
  const sqlite = new Database(':memory:');
  for (const migration of readMigrationFiles({ migrationsFolder })) {
    for (const statement of migration.sql) sqlite.exec(statement);
  }
  return createDb(betterSqliteExecutor(sqlite));
}

function betterSqliteExecutor(sqlite: Database.Database): Execute {
  return async (sql, params, method) => {
    const statement = sqlite.prepare(sql);
    if (method === 'run') {
      statement.run(...params);
      return { rows: [] };
    }
    const rows = statement.raw().all(...params);
    return { rows: method === 'get' ? (rows[0] as unknown[]) : rows };
  };
}
