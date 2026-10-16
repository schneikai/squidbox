/* eslint-disable @typescript-eslint/no-explicit-any -- generic over any read's result */
import { getTableName } from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';

import type { AppDb } from './db/driver';
import type { SyncDb } from './db/types';

export interface Watch {
  stop(): void;
  /** Disabled, a watch skips reads and only notes that one is due; enabling runs it, if due. */
  setEnabled(enabled: boolean): void;
}

export interface WatchOptions {
  /** The first read waits for a write, for a caller that already holds the current data. */
  waitForWrite?: boolean;
  /**
   * Coalesces a burst of writes to about one re-read per this many ms: a re-read starts right away
   * if the previous read began at least that long ago, else once it has (the writes meanwhile share
   * it). The first read and the catch-up read on enable never wait.
   */
  minInterval?: number;
}

/**
 * Keeps `onData` fed with the result of `read`: once on enable and again after each committed write
 * to any of `tables`. Reads never overlap (a write during one queues one more), and a watch starts
 * disabled with a read due. Once stopped, a watch drops a late result, and a read of it still waiting
 * in the db queue doesn't run (`read` gets a cancellable db, see AppDb.cancellable). Rows keep their
 * identity across reads (see reuseRows), so memoized cells re-render only for rows a write touched;
 * `previous` is the data a replaced watch last delivered, so a new watch (a load-more, a changed
 * query) reuses them too. `onData` also gets `readAt`, the db's committed-write count when the read
 * began (see AppDb.committedWrites): every write counted by then shows in the data. For `options`,
 * see WatchOptions.
 */
export function watchQuery<T>(
  db: AppDb,
  read: (db: SyncDb) => Promise<T>,
  tables: SQLiteTable[],
  onData: (data: T, readAt: number) => void,
  previous?: T,
  { waitForWrite = false, minInterval = 0 }: WatchOptions = {},
): Watch {
  const names = new Set(tables.map((table) => getTableName(table)));
  let isEnabled = false;
  let isOwed = !waitForWrite; // a read is owed: the watch is new, or a watched table changed since a read began
  let isLoading = false;
  let isStopped = false;
  let lastStartedAt = -Infinity; // now() when the last read began
  let timer: ReturnType<typeof setTimeout> | null = null;
  const readDb = db.cancellable(() => isStopped);

  async function load() {
    isLoading = true;
    isOwed = false;
    lastStartedAt = now();
    try {
      const readAt = db.committedWrites();
      const result: T = reuseRows(previous, await read(readDb));
      if (isStopped) return;
      previous = result;
      onData(result, readAt);
    } catch (error) {
      if (!isStopped) console.error('Live query failed', error);
    } finally {
      isLoading = false;
    }
    readIfOwed();
  }

  function readIfOwed() {
    if (!isOwed || !isEnabled || isLoading || isStopped) return;
    const wait = lastStartedAt + minInterval - now();
    if (wait > 0) {
      timer ??= setTimeout(() => {
        timer = null;
        readIfOwed();
      }, wait);
      return;
    }
    load();
  }

  function clearTimer() {
    if (timer) clearTimeout(timer);
    timer = null;
  }

  const stopWatching = db.onTablesChanged((changed) => {
    for (const name of changed) {
      if (!names.has(name)) continue;
      isOwed = true;
      readIfOwed();
      return;
    }
  });

  return {
    stop() {
      isStopped = true;
      clearTimer();
      stopWatching();
    },
    setEnabled(enabled) {
      // The catch-up read doesn't wait; with a read still in flight (begun before a disable) that read
      // lands at once and the next one keeps to the interval, so a quick blur and focus don't lift it.
      if (enabled && !isEnabled && !isLoading) lastStartedAt = -Infinity;
      if (!enabled) clearTimer();
      isEnabled = enabled;
      readIfOwed();
    },
  };
}

// A monotonic clock (Hermes and browsers have performance.now), so a wall-clock change can't stall
// or skip the interval.
function now(): number {
  return globalThis.performance?.now ? globalThis.performance.now() : Date.now();
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
