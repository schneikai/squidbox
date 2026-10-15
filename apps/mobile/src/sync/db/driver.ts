import { drizzle, type AsyncRemoteCallback } from 'drizzle-orm/sqlite-proxy';

import * as schema from './schema';

// `changes` (rows a `run` changed) lets a write that matched nothing skip notifying live reads.
export type Execute = (
  ...args: Parameters<AsyncRemoteCallback>
) => Promise<Awaited<ReturnType<AsyncRemoteCallback>> & { changes?: number }>;
type TablesChangedListener = (tables: Set<string>) => void;

// Statements drizzle generates for writes start like `insert into "assets"`, `update "assets"` or
// `delete from "assets"`; drizzle-kit's migrations quote with backticks (`INSERT INTO \`__new_assets\``).
const WRITTEN_TABLE = /^\s*(?:insert\s+into|update|delete\s+from)\s+["`]([^"`]+)["`]/i;
// Any other write (raw SQL with an unquoted table, REPLACE, INSERT OR …) would change a table without
// telling live reads, so it is refused.
const ANY_WRITE = /^\s*(?:insert|update|delete|replace)\b/i;

/**
 * An async drizzle database on top of `execute`, the same on every platform. All access runs
 * through one queue, and a transaction holds the queue from BEGIN to COMMIT, so nothing else can
 * interleave with it on the shared connection. Inside a transaction callback, use its `tx`: calling
 * `db` there would wait for the transaction itself and never finish.
 *
 * Instead of SQLite's per-row change events, listeners get one notification per committed unit of
 * work (a statement or a whole transaction) with the tables it changed; a write that changed no rows
 * (an update whose WHERE matched nothing) doesn't count.
 */
export function createDb(execute: Execute, close: () => Promise<void> = async () => {}) {
  let tail: Promise<unknown> = Promise.resolve();
  let written: Set<string> | null = null; // tables written by the unit that holds the queue
  let committedWrites = 0; // units that changed rows, so far
  let closed = false;
  const listeners = new Set<TablesChangedListener>();

  function queue<T>(work: () => Promise<T>): Promise<T> {
    if (closed) return Promise.reject(new Error('The database is closed'));
    const unit = tail.then(async () => {
      written = new Set();
      const result = await work();
      const tables = written;
      written = null;
      if (tables.size > 0) {
        committedWrites += 1;
        for (const listener of listeners) listener(tables);
      }
      return result;
    });
    tail = unit.catch(() => (written = null));
    return unit;
  }

  const executeTracked: Execute = async (sql, params, method) => {
    const table = WRITTEN_TABLE.exec(sql)?.[1];
    if (!table && ANY_WRITE.test(sql)) throw new Error(`Untracked write (see WRITTEN_TABLE): ${sql.slice(0, 80)}`);
    const result = await execute(sql, params, method);
    if (table && result.changes !== 0) written?.add(table);
    return result;
  };

  const inner = drizzle(executeTracked, { schema });
  const db = drizzle((sql, params, method) => queue(() => executeTracked(sql, params, method)), { schema });
  db.transaction = ((work, config) => queue(() => inner.transaction(work, config))) as typeof db.transaction;

  return Object.assign(db, {
    /**
     * How many units that changed rows have committed. A read that starts at N sees every one of
     * them; a write has committed by the time this counts it. So rows read at or after the count
     * noted right after a write show that write.
     */
    committedWrites(): number {
      return committedWrites;
    },
    onTablesChanged(listener: TablesChangedListener): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    /** Closes the connection once everything queued before has run; anything queued after rejects. */
    close(): Promise<void> {
      const closing = queue(close);
      closed = true;
      return closing;
    },
  });
}

export type AppDb = ReturnType<typeof createDb>;
