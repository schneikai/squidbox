import type { LiveSyncStatus } from '@/sync/useSyncStatus';

type FirstSyncStatus = Pick<LiveSyncStatus, 'phase' | 'lastError' | 'pullStep'>;

// How long "Finishing up" shows before it says "Almost done": the last batch's apply is usually
// quick, so one that runs on gets a word that it is nearly there.
export const ALMOST_DONE_MS = 5_000;

/**
 * The setup screen's one label for where the first sync is, and whether it failed. An error stays
 * through the auto-retries (their push and the pull's connecting stretch) until a retry pulls a batch.
 * `almostDone`: the finishing step has shown for ALMOST_DONE_MS.
 */
export default function getFirstSyncStep(
  { phase, lastError, pullStep }: FirstSyncStatus,
  almostDone: boolean,
): { label: string; failed: boolean } {
  const step = phase === 'pulling' ? pullStep : undefined;
  if (lastError && !step) return { label: "Can't reach the server", failed: true };
  if (step === 'finishing') return { label: almostDone ? 'Almost done' : 'Finishing up', failed: false };
  if (step === 'downloading') return { label: 'Downloading your library', failed: false };
  return { label: 'Setting up your library', failed: false };
}
