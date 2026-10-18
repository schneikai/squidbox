import type { AssetRecord, PullResponse } from '@squidbox/shared';
import type { SQLiteDatabase } from 'expo-sqlite';
import { describe, it, expect, beforeEach } from 'vitest';

import { makeAssetRecord } from './helpers/factory';
import { openMigrated } from './helpers/testDb';
import { createDb } from '../src/sync/db/driver';
import { CACHED_STATEMENTS, expoExecutor } from '../src/sync/db/expoExecutor';
import * as schema from '../src/sync/db/schema';
import { getCursor } from '../src/sync/status';
import { runSyncOnce } from '../src/sync/worker';

// expo-sqlite's async API over better-sqlite3, logging every prepare, reset, finalize and close.
function fakeExpoSqlite() {
  const sqlite = openMigrated();
  const events: string[] = [];
  let closed = false;
  const database = {
    async prepareAsync(sql: string) {
      if (closed) throw new Error('closed');
      events.push(`prepare ${sql}`);
      const statement = sqlite.prepare(sql);
      let finalized = false;
      return {
        async executeForRawResultAsync(params: unknown[]) {
          if (closed || finalized) throw new Error('finalized');
          const rows = statement.reader ? (statement.raw().all(...params) as unknown[][]) : [];
          const changes = statement.reader ? 0 : statement.run(...params).changes;
          return {
            changes,
            getAllAsync: async () => rows,
            getFirstAsync: async () => rows[0] ?? null,
            resetAsync: async () => {
              events.push(`reset ${sql}`);
            },
          };
        },
        async finalizeAsync() {
          if (closed) throw new Error('closed');
          finalized = true;
          events.push(`finalize ${sql}`);
        },
      };
    },
    async closeAsync() {
      closed = true;
      events.push('close');
      sqlite.close();
    },
  };
  return { execute: expoExecutor(database as unknown as SQLiteDatabase), close: () => database.closeAsync(), events };
}

const of = (events: string[], kind: string) => events.filter((event) => event.startsWith(`${kind} `));
const select = (i: number) => `select ${i}`;

let execute: ReturnType<typeof expoExecutor>;
let close: () => Promise<void>;
let events: string[];
beforeEach(() => {
  ({ execute, close, events } = fakeExpoSqlite());
});

// Runs SQL twice, so its statement is cached.
const twice = async (sql: string) => {
  await execute(sql, [], 'all');
  await execute(sql, [], 'all');
};

describe('expoExecutor', () => {
  it('prepares each repeated statement of a sync at most twice and keeps reusing it', async () => {
    const db = createDb(execute, close);
    const records: AssetRecord[] = Array.from({ length: 3_000 }, () => makeAssetRecord());
    const pull = async ({ cursor }: { cursor: number }): Promise<PullResponse> => {
      const page = records.slice(cursor, cursor + 1000);
      return { changes: { assets: { records: page } }, cursor: cursor + page.length, hasMore: cursor + 1000 < 3_000 };
    };

    await runSyncOnce(db, { pull, push: async () => ({ results: [] }) });
    await runSyncOnce(db, { pull, push: async () => ({ results: [] }) });

    expect(await db.select().from(schema.assets)).toHaveLength(3_000);
    expect(await getCursor(db)).toBe(3_000);
    const prepared = of(events, 'prepare');
    const timesBySql = new Map<string, number>();
    for (const event of prepared) timesBySql.set(event, (timesBySql.get(event) ?? 0) + 1);
    expect(Math.max(...timesBySql.values())).toBeLessThanOrEqual(2);
    expect(timesBySql.size).toBeLessThan(CACHED_STATEMENTS);
  });

  it('finalizes SQL run once after its run, and caches it the second time', async () => {
    await execute(select(1), [], 'all');
    expect(of(events, 'finalize')).toEqual([`finalize ${select(1)}`]);
    events.length = 0;
    await execute(select(1), [], 'all');
    await execute(select(1), [], 'all');
    expect(of(events, 'prepare')).toEqual([`prepare ${select(1)}`]);
    expect(of(events, 'finalize')).toEqual([]);
  });

  it('finalizes the least recently used statement once the cache is full', async () => {
    for (let i = 0; i < CACHED_STATEMENTS; i++) await twice(select(i));
    await execute(select(0), [], 'all'); // now the most recent
    events.length = 0;
    await twice(select(CACHED_STATEMENTS));

    expect(of(events, 'finalize')).toEqual([`finalize ${select(CACHED_STATEMENTS)}`, `finalize ${select(1)}`]);
    events.length = 0;
    await execute(select(0), [], 'all');
    expect(of(events, 'prepare')).toEqual([]);
  });

  it('finalizes a statement that failed instead of reusing it', async () => {
    const insert = 'insert into "sync_meta" ("key", "value") values (?, ?)';
    await execute(insert, ['k', '1'], 'run');
    await execute(insert, ['k2', '1'], 'run'); // cached now
    events.length = 0;
    await expect(execute(insert, ['k', '2'], 'run')).rejects.toThrow('UNIQUE');

    expect(of(events, 'finalize')).toEqual([`finalize ${insert}`]);
    await execute(insert, ['k3', '1'], 'run');
    expect(of(events, 'prepare')).toEqual([`prepare ${insert}`]);
  });

  it('resets a statement after reading one row of it', async () => {
    const result = await execute('select 1 union all select 2', [], 'get');
    expect(result.rows).toEqual([1]);
    expect(of(events, 'reset')).toHaveLength(1);
  });
});
