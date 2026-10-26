import { useEffect } from 'react';

import { getDb } from '@/sync/db/client';
import { seedPromptButtons } from '@/sync/promptButtonsRepository';
import { useFirstSyncDone } from '@/sync/useSyncStatus';
import { requestSync } from '@/sync/worker';

/**
 * Seeds the default prompt buttons once per library, after its first full pull (which brings another
 * device's buttons and deletions; seedPromptButtons checks again). For the screens that show them.
 */
export default function useSeedPromptButtons() {
  const isFirstSyncDone = useFirstSyncDone();

  useEffect(() => {
    if (!isFirstSyncDone) return;
    seedPromptButtons(getDb()).then(
      (isSeeded) => isSeeded && requestSync(),
      (error) => console.error('Seeding the prompt buttons failed', error),
    );
  }, [isFirstSyncDone]);
}
