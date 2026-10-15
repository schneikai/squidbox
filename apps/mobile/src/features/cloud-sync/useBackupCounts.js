import useCloud from '@/features/cloud/useCloud';
import { readBackupCounts } from '@/sync/assetsRepository';
import { schema } from '@/sync/db/client';
import { useLiveQuery } from '@/sync/useLiveQuery';

const NO_COUNTS = { unsyncedCount: 0, syncErrorCount: 0 };

/** The backup's live counts, `{ unsyncedCount, syncErrorCount }`; 0 while signed out (backup needs the cloud). */
export default function useBackupCounts() {
  const { isAuthenticated } = useCloud();
  return (
    useLiveQuery(
      async (db) => (isAuthenticated ? readBackupCounts(db) : NO_COUNTS),
      [schema.assets],
      [isAuthenticated],
    ) ?? NO_COUNTS
  );
}
