import { drizzle, type AsyncRemoteCallback } from 'drizzle-orm/sqlite-proxy';

import * as schema from './schema';

export type Execute = AsyncRemoteCallback;
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
 * work (a statement or a whole transaction) with the tables it wrote.
 */
export function createDb(execute: Execute) {
  let tail: Promise<unknown> = Promise.resolve();
  let written: Set<string> | null = null; // tables written by the unit that holds the queue
  const listeners = new Set<TablesChangedListener>();

  function queue<T>(work: () => Promise<T>): Promise<T> {
    const unit = tail.then(async () => {
      written = new Set();
      const result = await work();
      const tables = written;
      written = null;
      if (tables.size > 0) for (const listener of listeners) listener(tables);
      return result;
    });
    tail = unit.catch(() => (written = null));
    return unit;
  }

  const executeTracked: Execute = async (sql, params, method) => {
    const table = WRITTEN_TABLE.exec(sql)?.[1];
    if (table) written?.add(table);
    else if (ANY_WRITE.test(sql)) throw new Error(`Untracked write (see WRITTEN_TABLE): ${sql.slice(0, 80)}`);
    return execute(sql, params, method);
  };

  const inner = drizzle(executeTracked, { schema });
  const db = drizzle((sql, params, method) => queue(() => executeTracked(sql, params, method)), { schema });
  db.transaction = ((work, config) => queue(() => inner.transaction(work, config))) as typeof db.transaction;

  return Object.assign(db, {
    onTablesChanged(listener: TablesChangedListener): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  });
}

export type AppDb = ReturnType<typeof createDb>;
