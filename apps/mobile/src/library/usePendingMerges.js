import { useEffect, useRef } from 'react';

import { runPendingMerges } from './sessionLibrary';

import * as schema from '@/sync/db/schema';
import { anyMergePushed } from '@/sync/status';
import { useLiveQuery } from '@/sync/useLiveQuery';

// Runs the merges due when one can go on: when the open library's first full pull drains (every
// merge waits for it), and when the passes a merge committed into it have pushed (the source then
// learns their decisions and goes, sync-design §8). The boot covers a pull that drained before
// (LibraryProvider), so only the change from false runs it; a push runs it from any other value, as
// it may land before the first read, and a second run finds nothing to do.
export default function usePendingMerges(firstSyncDone) {
  const pushed = useLiveQuery(anyMergePushed, [schema.outbox, schema.syncMeta]);
  const before = useRef({ firstSyncDone, pushed });

  useEffect(() => {
    const drained = before.current.firstSyncDone === false && firstSyncDone === true;
    const pushedNow = before.current.pushed !== true && pushed === true;
    before.current = { firstSyncDone, pushed };
    if (!drained && !pushedNow) return;
    runPendingMerges().catch((error) => console.warn('Could not add this device’s library', error));
  }, [firstSyncDone, pushed]);
}
