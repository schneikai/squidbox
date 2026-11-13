import { betterSqliteExecutor, openMigrated } from './testDb';
import { createDb, type AppDb } from '../../src/sync/db/driver';
import { retryFailures } from '../../src/sync/outbox';

export interface CrashableDevice {
  /** The app's database; a new one after each restart, as the app opens it anew. */
  db: AppDb;
  /**
   * Runs `work` with the app killed at the `statement`th statement (from 1) after `work` calls `arm`:
   * that statement and every one after it fail, so `work` stops where it was. Then the app starts
   * again: SQLite drops the transaction that was open (its journal), and the library opens as the app
   * opens it (failed pushes retried). Whether it died.
   */
  crashDuring(statement: number, work: (db: AppDb, arm: () => void) => Promise<unknown>): Promise<boolean>;
}

/** An in-memory device (testDb's) whose app can be killed in the middle of a write or a sync. */
export function crashableDevice(): CrashableDevice {
  const sqlite = openMigrated();
  const execute = betterSqliteExecutor(sqlite);
  let left = Infinity;
  const open = () =>
    createDb(async (sql, params, method) => {
      if (--left < 0) throw new Error('the app was killed');
      return execute(sql, params, method);
    });
  const device: CrashableDevice = {
    db: open(),
    async crashDuring(statement, work) {
      let error: unknown;
      try {
        await work(device.db, () => (left = statement - 1));
      } catch (thrown) {
        error = thrown;
      }
      const died = left < 0;
      left = Infinity;
      if (!died && error) throw error;
      if (!died) return false;
      if (sqlite.inTransaction) sqlite.exec('rollback');
      device.db = open();
      await retryFailures(device.db);
      return true;
    },
  };
  return device;
}
