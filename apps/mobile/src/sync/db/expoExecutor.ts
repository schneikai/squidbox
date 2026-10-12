import type { SQLiteBindValue, SQLiteDatabase } from 'expo-sqlite';

import type { Execute } from './driver';

// Runs drizzle's statements on expo-sqlite's async API. Rows come back as value arrays (drizzle maps
// them by column index, so equal column names from a join can't collide); `get` returns one row.
export function expoExecutor(sqlite: SQLiteDatabase): Execute {
  return async (sql, params, method) => {
    const statement = await sqlite.prepareAsync(sql);
    try {
      const result = await statement.executeForRawResultAsync(params as SQLiteBindValue[]);
      if (method === 'run') return { rows: [] };
      const rows = await result.getAllAsync();
      return { rows: method === 'get' ? (rows[0] as unknown as unknown[]) : rows };
    } finally {
      await statement.finalizeAsync();
    }
  };
}
