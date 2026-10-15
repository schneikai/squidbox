import Database from 'better-sqlite3';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { fileURLToPath } from 'node:url';

import { createDb, type AppDb, type Execute } from '../../src/sync/db/driver';

// An in-memory SQLite "device" for tests: better-sqlite3 behind the app's own driver (createDb, so
// the same queue and transactions), with the same generated migrations the app ships.
const migrationsFolder = fileURLToPath(new URL('../../src/sync/db/migrations', import.meta.url));

export function makeTestDb(): AppDb {
  const sqlite = openMigrated();
  return createDb(betterSqliteExecutor(sqlite), async () => {
    sqlite.close();
  });
}

export interface Work {
  statements: number;
  commits: number; // transactions plus writes outside one: each is a disk sync and a live-read refresh
  rowsRead: number;
  plans: string[]; // every query-plan line of the reads, like "SCAN assets USING INDEX assets_live_created_idx"
  fullScans: string[]; // the "SCAN …" lines among them
}

/** A test db that also counts the work behind each call of `measure`. */
export function makeMeasuredTestDb(): { db: AppDb; measure(run: () => Promise<unknown>): Promise<Work> } {
  const sqlite = openMigrated();
  const execute = betterSqliteExecutor(sqlite);
  let log: { sql: string; params: unknown[]; rows: number }[] = [];
  const db = createDb(async (sql, params, method) => {
    const result = await execute(sql, params, method);
    log.push({ sql, params, rows: method === 'get' ? (result.rows.length > 0 ? 1 : 0) : result.rows.length });
    return result;
  });

  async function measure(run: () => Promise<unknown>): Promise<Work> {
    log = [];
    await run();
    const selects = log.filter((entry) => /^\s*select/i.test(entry.sql));
    const plans = selects.flatMap(({ sql, params }) =>
      (sqlite.prepare(`explain query plan ${sql}`).all(...params) as { detail: string }[]).map((step) => step.detail),
    );
    return {
      statements: log.length,
      commits: countCommits(log.map((entry) => entry.sql)),
      rowsRead: selects.reduce((sum, entry) => sum + entry.rows, 0),
      plans,
      fullScans: plans.filter((detail) => detail.startsWith('SCAN ')),
    };
  }

  return { db, measure };
}

function countCommits(statements: string[]): number {
  let commits = 0;
  let inTransaction = false;
  for (const sql of statements) {
    if (/^\s*begin/i.test(sql)) {
      inTransaction = true;
      commits += 1;
    } else if (/^\s*(commit|rollback)/i.test(sql)) inTransaction = false;
    else if (!inTransaction && /^\s*(insert|update|delete)/i.test(sql)) commits += 1;
  }
  return commits;
}

function openMigrated(): Database.Database {
  const sqlite = new Database(':memory:');
  for (const migration of readMigrationFiles({ migrationsFolder })) {
    for (const statement of migration.sql) sqlite.exec(statement);
  }
  return sqlite;
}

function betterSqliteExecutor(sqlite: Database.Database): Execute {
  return async (sql, params, method) => {
    const statement = sqlite.prepare(sql);
    if (method === 'run') {
      return { rows: [], changes: statement.run(...params).changes };
    }
    const rows = statement.raw().all(...params);
    return { rows: method === 'get' ? (rows[0] as unknown[]) : rows };
  };
}
