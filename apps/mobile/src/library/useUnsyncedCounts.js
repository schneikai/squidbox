import { readUnsyncedCounts } from './atRiskCount';

import { schema } from '@/sync/db/client';
import { useLiveQuery } from '@/sync/useLiveQuery';

const NO_COUNTS = { pendingCount: 0, atRiskCount: 0, unsyncedCount: 0, syncErrorCount: 0 };

// The open library's pending changes, unbacked-up photos and backup counts, live, in one query.
export default function useUnsyncedCounts() {
  return useLiveQuery(readUnsyncedCounts, [schema.outbox, schema.assets]) ?? NO_COUNTS;
}
