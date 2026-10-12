import { getTableName } from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';
import { useEffect, useState } from 'react';

import { getDb } from './db/client';

/**
 * The result of `read`, re-run once per committed write to any of `tables`; `undefined` until the
 * first read has finished. For whole tables use useLiveTable, which shares one read across screens.
 * `read` is taken from the first render, so it must not depend on changing values.
 */
export function useLiveQuery<T>(read: () => Promise<T>, tables: SQLiteTable[]): T | undefined {
  const [data, setData] = useState<T>();

  useEffect(() => {
    const names = new Set(tables.map((table) => getTableName(table)));
    let isMounted = true;
    const reload = () =>
      read()
        .then((result) => isMounted && setData(result))
        .catch((error) => console.error('Live query failed', error));

    reload();
    const stopWatching = getDb().onTablesChanged((changed) => [...changed].some((name) => names.has(name)) && reload());
    return () => {
      isMounted = false;
      stopWatching();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see the doc comment
  }, []);

  return data;
}
