import { readUnsyncedCounts } from './atRiskCount';

import { schema } from '@/sync/db/client';
import { useLiveQuery } from '@/sync/useLiveQuery';

const NO_COUNTS = { pendingCount: 0, atRiskCount: 0 };

// The open library's pending changes and unbacked-up photos, live.
export default function useUnsyncedCounts() {
  return useLiveQuery(readUnsyncedCounts, [schema.outbox, schema.assets]) ?? NO_COUNTS;
}
