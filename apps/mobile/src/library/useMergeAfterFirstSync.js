import { useEffect, useRef } from 'react';

import { resumeMerges } from './mergeRun';
import { mergeDeviceLibrary } from './sessionLibrary';

import { withSyncPaused } from '@/sync/worker';

// A merge into a library waits for its first full pull (planMerge): when that pull drains, this
// device's library joins it, and a merge that waited for it resumes. The boot covers a library
// whose first pull drained before (LibraryProvider), so only the change from false runs it.
export default function useMergeAfterFirstSync(firstSyncDone) {
  const before = useRef(firstSyncDone);

  useEffect(() => {
    const drained = before.current === false && firstSyncDone === true;
    before.current = firstSyncDone;
    if (!drained) return;
    withSyncPaused(async () => {
      await resumeMerges();
      await mergeDeviceLibrary();
    }).catch((error) => console.warn('Could not add this device’s library after the first sync', error));
  }, [firstSyncDone]);
}
