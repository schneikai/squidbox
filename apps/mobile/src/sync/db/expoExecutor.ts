import type { SQLiteBindValue, SQLiteDatabase, SQLiteStatement } from 'expo-sqlite';

import type { Execute } from './driver';

// Prepared statements kept for reuse, least recently used first out. A sync and the screens' live
// reads repeat a few dozen statements, and preparing a 500-row upsert means parsing ~35 KB of SQL.
export const CACHED_STATEMENTS = 50;
const SEEN_SQL = 500; // SQL texts remembered as run once

/**
 * Runs drizzle's statements on expo-sqlite's async API. Rows come back as value arrays (drizzle maps
 * them by column index, so equal column names from a join can't collide); `get` returns one row.
 *
 * A statement whose SQL repeats is prepared once and reused: expo-sqlite resets a statement and
 * clears its bindings before every run (also after one that failed), and closing the connection
 * finalizes them. SQL run once (a batch's short last chunk, an id list) is finalized after it, so it
 * neither pushes out the repeating ones nor keeps its bound values. A transaction's statements can
 * run at once, so a statement that is running isn't handed out again.
 */
export function expoExecutor(sqlite: SQLiteDatabase): Execute {
  const statements = new Map<string, SQLiteStatement>();
  const seenOnce = new Set<string>(); // by `sqlKey`, oldest first
  const running = new Set<SQLiteStatement>();

  async function prepared(sql: string): Promise<SQLiteStatement> {
    const cached = statements.get(sql);
    if (cached && !running.has(cached)) {
      statements.delete(sql);
      statements.set(sql, cached); // most recently used
      running.add(cached); // before any await, so a call at once can't take it too
      return cached;
    }
    const statement = await sqlite.prepareAsync(sql);
    if (cached) return statement; // a second one while the cached one runs
    const key = sqlKey(sql);
    if (!seenOnce.delete(key)) {
      seenOnce.add(key);
      if (seenOnce.size > SEEN_SQL) seenOnce.delete(seenOnce.values().next().value!);
      return statement;
    }
    statements.set(sql, statement);
    if (statements.size > CACHED_STATEMENTS) {
      const [oldestSql, oldest] = statements.entries().next().value!;
      statements.delete(oldestSql);
      await finalize(oldest);
    }
    return statement;
  }

  return async (sql, params, method) => {
    const statement = await prepared(sql);
    try {
      return await run(statement, params as SQLiteBindValue[], method);
    } finally {
      running.delete(statement);
      if (statements.get(sql) !== statement) await finalize(statement);
    }
  };
}

async function run(statement: SQLiteStatement, params: SQLiteBindValue[], method: Parameters<Execute>[2]) {
  const result = await statement.executeForRawResultAsync(params);
  if (method === 'run') {
    await result.getAllAsync(); // steps a `run` that returned rows to its end
    return { rows: [], changes: result.changes };
  }
  if (method !== 'get') return { rows: await result.getAllAsync() };
  const row = ((await result.getFirstAsync()) ?? undefined) as unknown as unknown[];
  // The cursor stays on that row until reset, which would hold the statement open.
  if (row) await result.resetAsync();
  return { rows: row };
}

// A short stand-in for SQL that can be tens of KB long (FNV-1a and the length); a collision only
// caches a statement one run early.
function sqlKey(sql: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < sql.length; i++) hash = Math.imul(hash ^ sql.charCodeAt(i), 0x01000193);
  return `${sql.length}:${hash >>> 0}`;
}

// A failed finalize doesn't fail the caller: closing the connection finalizes what is left.
function finalize(statement: SQLiteStatement): Promise<void> {
  return statement.finalizeAsync().catch(() => {});
}
