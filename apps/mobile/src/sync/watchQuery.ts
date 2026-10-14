/* eslint-disable @typescript-eslint/no-explicit-any -- generic over any read's result */
import { getTableName } from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';

import type { AppDb } from './db/driver';

export interface Watch {
  stop(): void;
  /** Disabled, a watch skips reads and only notes that one is due; enabling runs it, if due. */
  setEnabled(enabled: boolean): void;
}

/**
 * Keeps `onData` fed with the result of `read`: once on enable and again after each committed write
 * to any of `tables`. Reads never overlap (a write during one queues one more), a stopped watch
 * drops a late result, and a watch starts disabled with a read due. Rows keep their identity across
 * reads (see reuseRows), so memoized cells re-render only for rows a write touched; `previous` is the
 * data a replaced watch last delivered, so a new watch (a load-more, a changed query) reuses them too.
 */
export function watchQuery<T>(
  db: AppDb,
  read: (db: AppDb) => Promise<T>,
  tables: SQLiteTable[],
  onData: (data: T) => void,
  previous?: T,
): Watch {
  const names = new Set(tables.map((table) => getTableName(table)));
  let isEnabled = false;
  let isOwed = true; // a read is owed: the watch is new, or a watched table changed since a read began
  let isLoading = false;
  let isStopped = false;

  async function load() {
    isLoading = true;
    while (isOwed && isEnabled && !isStopped) {
      isOwed = false;
      try {
        const result: T = reuseRows(previous, await read(db));
        if (isStopped) return;
        previous = result;
        onData(result);
      } catch (error) {
        console.error('Live query failed', error);
      }
    }
    isLoading = false;
  }

  function readIfOwed() {
    if (isOwed && isEnabled && !isLoading && !isStopped) load();
  }

  function reload() {
    isOwed = true;
    readIfOwed();
  }

  const stopWatching = db.onTablesChanged((changed) => [...changed].some((name) => names.has(name)) && reload());

  return {
    stop() {
      isStopped = true;
      stopWatching();
    },
    setEnabled(enabled) {
      isEnabled = enabled;
      readIfOwed();
    },
  };
}

// The previous object wherever the new one has the same contents: rows (anything with an `id`) are
// matched by id and compared field by field, recursively, so a nested row (an album's cover, a post's
// assets) reuses too; an array or a plain object whose every part is reused is the previous one.
function reuseRows(previous: any, next: any): any {
  if (previous === next || previous == null || next == null) return next;
  if (Array.isArray(next)) {
    if (!Array.isArray(previous)) return next;
    const byId = new Map(previous.filter((row) => row?.id != null).map((row) => [row.id, row]));
    let isSame = previous.length === next.length;
    const rows = next.map((row, index) => {
      const reused = row?.id != null ? reuseRows(byId.get(row.id), row) : row;
      if (reused !== previous[index]) isSame = false;
      return reused;
    });
    return isSame ? previous : rows;
  }
  if (!isPlainObject(next) || !isPlainObject(previous)) return next;
  const keys = Object.keys(next);
  if (keys.length !== Object.keys(previous).length) return next;
  let isSame = true;
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    out[key] = reuseRows(previous[key], next[key]);
    if (out[key] !== previous[key]) isSame = false;
  }
  return isSame ? previous : out;
}

function isPlainObject(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && Object.getPrototypeOf(value) === Object.prototype;
}
