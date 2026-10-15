import { count } from 'drizzle-orm';

import { readBackupCounts, type BackupCounts } from '@/sync/assetsRepository';
import * as schema from '@/sync/db/schema';
import type { SyncDb } from '@/sync/db/types';

export interface UnsyncedCounts extends BackupCounts {
  pendingCount: number; // changes waiting in the outbox
}

// What a library would lose if it were removed now, and what its backup still has to do: its pending
// changes and its photos not in the cloud (readBackupCounts defines those next to the upload queue).
export async function readUnsyncedCounts(db: SyncDb): Promise<UnsyncedCounts> {
  const [pending] = await db.select({ count: count() }).from(schema.outbox);
  return { pendingCount: pending?.count ?? 0, ...(await readBackupCounts(db)) };
}
