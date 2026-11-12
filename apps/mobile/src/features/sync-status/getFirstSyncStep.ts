import type { PullStep } from '@/sync/status';
import type { LiveSyncStatus } from '@/sync/useSyncStatus';

type FirstSyncStatus = Pick<LiveSyncStatus, 'phase' | 'lastError' | 'pullStep'>;
// `wasFailed`: the screen showed the failure last time and no batch arrived since. `almostDone`: the
// finishing step has shown for a while.
type Shown = { wasFailed: boolean; almostDone: boolean };

/**
 * The setup screen's one label for where the first sync is, whether it failed, and the pull's step
 * as it counts (only while pulling). A failed run fails the screen; the failure it showed stays
 * through the auto-retries (their push and the pull's connecting stretch) until a retry pulls a batch.
 * An error a run left behind is not shown by itself: the run after it (on a new launch) says where it
 * is until it fails too.
 */
export default function getFirstSyncStep(
  { phase, lastError, pullStep }: FirstSyncStatus,
  { wasFailed, almostDone }: Shown,
): { label: string; failed: boolean; step: PullStep | undefined } {
  const step = phase === 'pulling' ? pullStep : undefined;
  if (lastError && (phase === 'error' || (wasFailed && !step)))
    return { label: "Can't reach the server", failed: true, step };
  if (step === 'finishing') return { label: almostDone ? 'Almost done' : 'Finishing up', failed: false, step };
  if (step === 'downloading') return { label: 'Downloading your library', failed: false, step };
  return { label: 'Setting up your library', failed: false, step };
}
