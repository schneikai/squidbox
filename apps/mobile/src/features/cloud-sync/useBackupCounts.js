import { readBackupCounts } from '@/sync/assetsRepository';
import { schema } from '@/sync/db/client';
import { useLiveQuery } from '@/sync/useLiveQuery';

const NO_COUNTS = { unsyncedCount: 0, syncErrorCount: 0 };

/** The backup's live counts, `{ unsyncedCount, syncErrorCount }` (the run itself needs the session). */
export default function useBackupCounts() {
  return useLiveQuery(readBackupCounts, [schema.assets]) ?? NO_COUNTS;
}
