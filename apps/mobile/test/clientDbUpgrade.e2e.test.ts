import Database from 'better-sqlite3';
import { count } from 'drizzle-orm';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

import { betterSqliteExecutor, migrationIndex, runMigrations } from './helpers/testDb';
import { USER, pushLog, serverRows, sync, useTwoDeviceServer } from './helpers/twoDeviceServer';
import { clientCollectionTables } from '../src/sync/clientCollections';
import { createDb } from '../src/sync/db/driver';
import * as schema from '../src/sync/db/schema';
import { readPushFailures } from '../src/sync/readPushFailures';
import { setOwner } from '../src/sync/status';

// Every past client database upgrades to today's schema (docs/sync-design.md §15): a sample database
// recorded at each client migration (scripts/recordClientDb.ts, `npm run contract:record`) is
// migrated through today's later migrations, read by today's code, and its pending edits land on
// today's server. The fixture of today's last migration checks today's push of today's rows.
const FIXTURES = fileURLToPath(new URL('./fixtures/client-db/', import.meta.url));
const fixtures = readdirSync(FIXTURES)
  .filter((file) => file.endsWith('.json'))
  .sort();

type Fixture = { migration: string; tables: Record<string, Record<string, unknown>[]> };

// The fixture's database, as that build left it, upgraded by today's migrations.
function upgraded({ migration, tables }: Fixture): Database.Database {
  const sqlite = new Database(':memory:');
  const through = migrationIndex(migration) + 1;
  runMigrations(sqlite, { to: through });
  for (const [table, rows] of Object.entries(tables))
    for (const row of rows) {
      const columns = Object.keys(row);
      sqlite
        .prepare(
          `INSERT INTO "${table}" (${columns.map((column) => `"${column}"`).join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
        )
        .run(...Object.values(row));
    }
  runMigrations(sqlite, { from: through });
  return sqlite;
}

describe.each(fixtures)('the client database recorded at %s', (file) => {
  useTwoDeviceServer();
  const fixture = JSON.parse(readFileSync(`${FIXTURES}${file}`, 'utf8')) as Fixture;

  it('upgrades to today’s schema keeping every row, and today’s code reads it', async () => {
    const sqlite = upgraded(fixture);
    for (const [table, rows] of Object.entries(fixture.tables))
      expect(sqlite.prepare(`SELECT count(*) AS n FROM "${table}"`).get(), table).toEqual({ n: rows.length });
    const db = createDb(betterSqliteExecutor(sqlite));
    for (const [name, table] of Object.entries(clientCollectionTables))
      expect(await db.select().from(table), name).toHaveLength(fixture.tables[name]?.length ?? 0);
    expect((await readPushFailures(db, { limit: 100 })).count).toBe(0);
  });

  it('pushes its pending edits to today’s server, none rejected', async () => {
    const db = createDb(betterSqliteExecutor(upgraded(fixture)));
    await setOwner(db, { kind: 'account', serverId: 'server', userId: USER, email: '' });
    await sync(db);
    expect(await db.select({ n: count() }).from(schema.outbox)).toEqual([{ n: 0 }]);
    const results = pushLog.flatMap((push) => push.results);
    expect(results.filter((result) => result.status === 'rejected')).toEqual([]);
    const outbox = fixture.tables.outbox ?? [];
    for (const collection of new Set(outbox.map((row) => row.collection as string))) {
      const ids = outbox.filter((row) => row.collection === collection).map((row) => row.record_id as string);
      expect([...(await serverRows(collection, ids)).keys()].sort(), collection).toEqual([...new Set(ids)].sort());
    }
  });
});
