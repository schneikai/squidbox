import { desc } from 'drizzle-orm';

import * as schema from '../../src/sync/db/schema';
import type { SyncDb } from '../../src/sync/db/types';

/** The newest sync_log row: the last run's counts, error and notes. */
export async function lastSyncLog(db: SyncDb) {
  const [log] = await db.select().from(schema.syncLog).orderBy(desc(schema.syncLog.id)).limit(1);
  return log;
}
