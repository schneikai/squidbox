import type { SQLiteBindValue, SQLiteDatabase, SQLiteStatement } from 'expo-sqlite';

import type { Execute } from './driver';

// Prepared statements kept for reuse, least recently used first out. A sync and the screens' live
// reads repeat a few dozen statements, and preparing a 500-row upsert means parsing ~35 KB of SQL.
export const CACHED_STATEMENTS = 50;

/**
 * Runs drizzle's statements on expo-sqlite's async API. Rows come back as value arrays (drizzle maps
 * them by column index, so equal column names from a join can't collide); `get` returns one row.
 *
 * Statements are prepared once per SQL text and reused: expo-sqlite resets a statement and clears
 * its bindings before every run. One that is running is out of the cache, so a second caller of
 * the same SQL prepares its own; one that failed is finalized. `close` finalizes them all and then
 * closes the connection, so a closed database's statements are never reused.
 */
export function expoExecutor(sqlite: SQLiteDatabase): { execute: Execute; close(): Promise<void> } {
  const statements = new Map<string, SQLiteStatement>();
  let closed = false;

  async function take(sql: string): Promise<SQLiteStatement> {
    const cached = statements.get(sql);
    if (!cached) return sqlite.prepareAsync(sql);
    statements.delete(sql);
    return cached;
  }

  async function putBack(sql: string, statement: SQLiteStatement): Promise<void> {
    if (closed) return; // closing the connection finalizes it
    if (statements.has(sql)) return finalize(statement);
    statements.set(sql, statement);
    if (statements.size <= CACHED_STATEMENTS) return;
    const [oldestSql, oldest] = statements.entries().next().value!;
    statements.delete(oldestSql);
    await finalize(oldest);
  }

  const execute: Execute = async (sql, params, method) => {
    if (closed) throw new Error('The database is closed');
    const statement = await take(sql);
    let rows: unknown[];
    let changes: number;
    try {
      const result = await statement.executeForRawResultAsync(params as SQLiteBindValue[]);
      changes = result.changes;
      if (method === 'get') {
        rows = ((await result.getFirstAsync()) ?? undefined) as unknown as unknown[];
        // The cursor stays on that row until reset, which would hold the statement open.
        if (rows) await result.resetAsync();
      } else rows = await result.getAllAsync(); // also steps a `run` that returned rows to its end
    } catch (error) {
      await finalize(statement);
      throw error;
    }
    await putBack(sql, statement);
    return method === 'run' ? { rows: [], changes } : { rows };
  };

  async function close(): Promise<void> {
    closed = true;
    const open = [...statements.values()];
    statements.clear();
    for (const statement of open) await finalize(statement);
    await sqlite.closeAsync();
  }

  return { execute, close };
}

// A failed finalize doesn't fail the caller: closing the connection finalizes what is left.
function finalize(statement: SQLiteStatement): Promise<void> {
  return statement.finalizeAsync().catch(() => {});
}
