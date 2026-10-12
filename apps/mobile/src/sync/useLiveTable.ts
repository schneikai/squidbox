import { getTableName } from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';
import { useCallback, useSyncExternalStore } from 'react';

import { getDb } from './db/client';
import { readLiveRows, type LiveRows } from './readLiveRows';

// One live read per table, shared by every component that shows it: it loads when the first one
// subscribes, refreshes once per committed write to the table (see createDb) by fetching only the
// changed rows (see readLiveRows), and is dropped when the last one unsubscribes. Refreshes never
// overlap: a write during one triggers one more.
interface LiveTable {
  current: LiveRows | undefined;
  listeners: Set<() => void>;
  stopWatching: () => void;
  isLoading: boolean;
  isStale: boolean;
}

const liveTables = new Map<string, LiveTable>();

function refresh(table: SQLiteTable, entry: LiveTable): void {
  if (entry.isLoading) {
    entry.isStale = true;
    return;
  }
  entry.isLoading = true;
  readLiveRows(getDb(), table, entry.current)
    .then((next) => {
      if (next === entry.current) return;
      entry.current = next;
      for (const listener of entry.listeners) listener();
    })
    .catch((error) => console.error(`Live read of ${getTableName(table)} failed`, error))
    .finally(() => {
      entry.isLoading = false;
      if (!entry.isStale) return;
      entry.isStale = false;
      refresh(table, entry);
    });
}

function subscribe(table: SQLiteTable, listener: () => void): () => void {
  const name = getTableName(table);
  let entry = liveTables.get(name);
  if (!entry) {
    const created: LiveTable = {
      current: undefined,
      listeners: new Set(),
      stopWatching: () => {},
      isLoading: false,
      isStale: false,
    };
    created.stopWatching = getDb().onTablesChanged((tables) => tables.has(name) && refresh(table, created));
    liveTables.set(name, created);
    refresh(table, created);
    entry = created;
  }
  entry.listeners.add(listener);

  return () => {
    entry.listeners.delete(listener);
    if (entry.listeners.size > 0) return;
    entry.stopWatching();
    liveTables.delete(name);
  };
}

/** All rows of `table`, live; `undefined` until the first read has finished. */
export function useLiveTable<Row>(table: SQLiteTable): Row[] | undefined {
  const subscribeToTable = useCallback((listener: () => void) => subscribe(table, listener), [table]);
  const getRows = useCallback(() => liveTables.get(getTableName(table))?.current?.rows as Row[] | undefined, [table]);
  return useSyncExternalStore(subscribeToTable, getRows);
}
