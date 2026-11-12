import { useEffect, useState } from 'react';

import Button from '@/components/Button';
import SplashStage from '@/components/SplashStage';
import useCloud from '@/features/cloud/useCloud';
import getFirstSyncStep from '@/features/sync-status/getFirstSyncStep';
import useAfterDelay from '@/hooks/useAfterDelay';
import { deviceLibraryToJoin } from '@/library/sessionLibrary';
import type { PullStep } from '@/sync/status';
import { type LiveSyncStatus, useSyncStatus } from '@/sync/useSyncStatus';
import { requestSync } from '@/sync/worker';
import confirmAsync from '@/utils/confirmAsync';

// Shown once, right after the first login, while the initial library pull runs. Gating the app
// behind this (a) tells the user it's intentional and one-time, and (b) keeps the heavy asset
// grids unmounted during the bulk load so the sync isn't fighting the UI. It carries on the splash,
// with one label for the pull's step (getFirstSyncStep), no counts.
const RETRY_MS = 5_000;
// How long "Finishing up" shows before it says "Almost done": the last batch's apply is usually
// quick, so one that runs on gets a word that it is nearly there.
const ALMOST_DONE_MS = 5_000;

export default function FirstSyncScreen() {
  const status = useSyncStatus();
  const { logoutAsync } = useCloud();
  const { label, failed } = useFirstSyncStep(status);

  // Never sit dead on an error: auto-retry the pull on a short interval while this screen shows an
  // error, and self-heal without the user restarting. (The normal 30s trigger still runs too.)
  useEffect(() => {
    if (!failed) return undefined;
    const id = setInterval(() => requestSync(), RETRY_MS);
    return () => clearInterval(id);
  }, [failed]);

  // Signing out stops the first pull, so it asks first; watchTokenDrops then opens the library to
  // show. This device's library waits to join the account's until the first pull is done (mergeWaits
  // in library/mergeLibrary.ts).
  async function handleSignOut() {
    const message = deviceLibraryToJoin()
      ? 'This iPhone’s photos stay here and join your account the next time you sign in.'
      : 'Setting up your library goes on the next time you sign in.';
    const title = 'Sign out before setup finishes?';
    if (await confirmAsync({ title, message, action: 'Sign Out', destructive: true })) await logoutAsync();
  }

  return (
    <SplashStage
      label={label}
      busy={!failed}
      // A sign-out stops the pull at its next batch; the library keeps what it pulled.
      footer={<Button label="Sign out" isInverse onPress={handleSignOut} />}
    >
      {failed && <Button label="Try again" isInverse colorPalette="neutral" onPress={() => requestSync()} />}
    </SplashStage>
  );
}

// getFirstSyncStep, with what the screen showed last: whether it failed, and how long the finishing
// step has shown.
function useFirstSyncStep(status: LiveSyncStatus) {
  const [shown, setShown] = useState<{ failed: boolean; step?: PullStep }>({ failed: false });
  const almostDone = useAfterDelay(shown.step === 'finishing', ALMOST_DONE_MS);
  const current = getFirstSyncStep(status, { wasFailed: shown.failed, almostDone });

  useEffect(() => setShown({ failed: current.failed, step: current.step }), [current.failed, current.step]);

  return current;
}
