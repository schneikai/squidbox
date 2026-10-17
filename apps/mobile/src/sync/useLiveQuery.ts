import { getTableName } from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';
import { useEffect, useRef, useState } from 'react';

import { getDb } from './db/client';
import type { SyncDb } from './db/types';
import { watchQuery, type Watch, type WatchOptions } from './watchQuery';

import useScreenFocus from '@/hooks/useScreenFocus';

const NOT_READ = { data: undefined, readAt: -1 };

/**
 * The result of `read`, re-run after each committed write to any of `tables` while the screen is
 * focused; `undefined` until the first read has finished. A change of `deps` starts a new watch (the
 * previous data stays until its first read lands), so `read` must be pure given `deps`: a write
 * re-runs the closure captured when they last changed. A blurred screen reads nothing; on focus it
 * reads once if a write or a deps change happened meanwhile. A re-read that returns the same data
 * renders nothing. `options`: see WatchOptions.
 */
export function useLiveQuery<T>(
  read: (db: SyncDb) => Promise<T>,
  tables: SQLiteTable[],
  deps: unknown[] = [],
  options: WatchOptions = {},
) {
  const [data, setData] = useState<T>();
  useWatch(read, tables, deps, data, setData, options);
  return data;
}

/**
 * useLiveQuery with how fresh the data is: `readAt` is the db's committed-write count when the read
 * that produced it began (AppDb.committedWrites), -1 before the first. With `everyRead`, every read
 * updates it, so a consumer waiting for a read after some write sees it even when the rows came back
 * the same (the screen renders once per read; unchanged rows keep their memoized cells); otherwise
 * it only changes with the data, which renders nothing for an identical re-read. The other
 * `options`: see WatchOptions.
 */
export function useLiveQueryState<T>(
  read: (db: SyncDb) => Promise<T>,
  tables: SQLiteTable[],
  deps: unknown[] = [],
  { everyRead = false, ...options }: { everyRead?: boolean } & WatchOptions = {},
): { data: T | undefined; readAt: number } {
  const [state, setState] = useState<{ data: T | undefined; readAt: number }>(NOT_READ);
  useWatch(
    read,
    tables,
    deps,
    state.data,
    (data: T, readAt: number) =>
      setState((current) => (!everyRead && current.data === data ? current : { data, readAt })),
    options,
  );
  return state;
}

// The watch behind both hooks: one per tables and deps, enabled while the screen is focused.
function useWatch<T>(
  read: (db: SyncDb) => Promise<T>,
  tables: SQLiteTable[],
  deps: unknown[],
  data: T | undefined,
  onData: (data: T, readAt: number) => void,
  options: WatchOptions = {},
) {
  const dataRef = useRef(data);
  dataRef.current = data;
  const watch = useRef<Watch>(null);
  const isFocused = useScreenFocus();
  const tableNames = tables.map((table) => getTableName(table)).join();
  const depsKey = JSON.stringify(deps);

  useEffect(() => {
    watch.current = watchQuery(getDb(), read, tables, onData, dataRef.current, options);
    return watch.current.stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see useLiveQuery
  }, [tableNames, depsKey]);

  useEffect(() => {
    watch.current?.setEnabled(isFocused);
  }, [isFocused, tableNames, depsKey]);
}
