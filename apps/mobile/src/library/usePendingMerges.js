import { useEffect, useRef } from 'react';

import { runPendingMerges } from './sessionLibrary';

import { MIN_REREAD_INTERVAL } from '@/constants';
import * as schema from '@/sync/db/schema';
import { anyMergePushed } from '@/sync/status';
import { useLiveQuery } from '@/sync/useLiveQuery';

// Runs the merges due when one can go on: when the open library's first full pull drains (every
// merge waits for it), and once the passes a merge committed into it have pushed (the source then
// learns their decisions and goes, sync-design §8). Each runs on a change to true only: the boot
// covers a pull that drained before (LibraryProvider), and a merge that can't finish isn't tried
// again until the next boot or commit. A push may land before the first read, so that change counts
// from any other value; a second run finds nothing to do. A sync run the merges cut short runs again
// after them (withSyncPaused).
export default function usePendingMerges(firstSyncDone) {
  const pushed = useLiveQuery(anyMergePushed, [schema.outbox, schema.syncMeta], [], {
    minInterval: MIN_REREAD_INTERVAL,
  });
  const before = useRef({ firstSyncDone, pushed });

  useEffect(() => {
    const drained = before.current.firstSyncDone === false && firstSyncDone === true;
    const pushedNow = before.current.pushed !== true && pushed === true;
    before.current = { firstSyncDone, pushed };
    if (!drained && !pushedNow) return;
    runPendingMerges().catch((error) => console.warn('Could not add this device’s library', error));
  }, [firstSyncDone, pushed]);
}
