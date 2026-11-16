import { getDb } from './db/client';
import type { SyncDb } from './db/types';
import { requestSync } from './worker';

/**
 * A user action's write: `write` in one transaction of the open library (a repository's own
 * transactions inside it become savepoints, so readers never see half of it), then a sync request.
 * Resolves to the write's result.
 */
export default async function written<T>(write: (tx: SyncDb) => Promise<T>): Promise<T> {
  const result = await getDb().transaction(write);
  requestSync();
  return result;
}
