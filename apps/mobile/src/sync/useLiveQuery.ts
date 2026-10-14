import { getTableName } from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';
import { useEffect, useRef, useState } from 'react';

import { getDb } from './db/client';
import type { AppDb } from './db/driver';
import { watchQuery, type Watch } from './watchQuery';

import useScreenFocus from '@/hooks/useScreenFocus';

/**
 * The result of `read`, re-run after each committed write to any of `tables` while the screen is
 * focused; `undefined` until the first read has finished. A change of `deps` starts a new watch (the
 * previous data stays until its first read lands), so `read` must be pure given `deps`: a write
 * re-runs the closure captured when they last changed. A blurred screen reads nothing; on focus it
 * reads once if a write or a deps change happened meanwhile.
 */
export function useLiveQuery<T>(
  read: (db: AppDb) => Promise<T>,
  tables: SQLiteTable[],
  deps: unknown[] = [],
): T | undefined {
  const [data, setData] = useState<T>();
  const dataRef = useRef(data);
  dataRef.current = data;
  const watch = useRef<Watch>(null);
  const isFocused = useScreenFocus();
  const tableNames = tables.map((table) => getTableName(table)).join();
  const depsKey = JSON.stringify(deps);

  useEffect(() => {
    watch.current = watchQuery(getDb(), read, tables, setData, dataRef.current);
    return watch.current.stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see the doc comment
  }, [tableNames, depsKey]);

  useEffect(() => {
    watch.current?.setEnabled(isFocused);
  }, [isFocused, tableNames, depsKey]);

  return data;
}
