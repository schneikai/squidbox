import { and, count, eq, isNull } from 'drizzle-orm';

import * as schema from '@/sync/db/schema';
import type { SyncDb } from '@/sync/db/types';

export interface UnsyncedCounts {
  pendingCount: number; // changes waiting in the outbox
  atRiskCount: number; // photos whose file isn't in the cloud (failed uploads included; deleted ones not)
}

// What a library would lose if it were removed now: its pending changes and its unbacked-up photos.
export async function readUnsyncedCounts(db: SyncDb): Promise<UnsyncedCounts> {
  const [pending] = await db.select({ count: count() }).from(schema.outbox);
  const [atRisk] = await db
    .select({ count: count() })
    .from(schema.assets)
    .where(and(eq(schema.assets.isSynced, false), isNull(schema.assets.deletedAt)));
  return { pendingCount: pending?.count ?? 0, atRiskCount: atRisk?.count ?? 0 };
}
