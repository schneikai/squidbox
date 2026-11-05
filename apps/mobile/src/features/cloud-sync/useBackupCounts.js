import { readBackupCounts } from '@/sync/assetsRepository';
import { readUnsyncedAvatarCount } from '@/sync/contactsRepository';
import { schema } from '@/sync/db/client';
import { useLiveQuery } from '@/sync/useLiveQuery';

const NO_COUNTS = { unsyncedCount: 0, syncErrorCount: 0 };

// The assets' counts, the contacts' photos waiting for their upload among the unsynced.
async function readCounts(db) {
  const counts = await readBackupCounts(db);
  return { ...counts, unsyncedCount: counts.unsyncedCount + (await readUnsyncedAvatarCount(db)) };
}

/** The backup's live counts, `{ unsyncedCount, syncErrorCount }` (the run itself needs the session). */
export default function useBackupCounts() {
  return useLiveQuery(readCounts, [schema.assets, schema.contacts]) ?? NO_COUNTS;
}
