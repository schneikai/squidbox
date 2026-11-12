import { useEffect, useState, useSyncExternalStore } from 'react';

import Button from '@/components/Button';
import SplashStage from '@/components/SplashStage';
import useCloud from '@/features/cloud/useCloud';
import getFirstSyncStep, { ALMOST_DONE_MS } from '@/features/sync-status/getFirstSyncStep';
import { onRegistryChange } from '@/library/registry';
import { deviceLibraryToJoin } from '@/library/sessionLibrary';
import { useSyncStatus } from '@/sync/useSyncStatus';
import { requestSync } from '@/sync/worker';
import confirmAsync from '@/utils/confirmAsync';

// Shown once, right after the first login, while the initial library pull runs. Gating the app
// behind this (a) tells the user it's intentional and one-time, and (b) keeps the heavy asset
// grids unmounted during the bulk load so the sync isn't fighting the UI. It carries on the splash,
// with one label for the pull's step (getFirstSyncStep), no counts.
const RETRY_MS = 5_000;

// Whether this device's library waits to join the open one: every merge waits for the first pull
// (mergeWaits in library/mergeLibrary.ts).
const deviceLibraryWaits = () => Boolean(deviceLibraryToJoin());

export default function FirstSyncScreen() {
  const status = useSyncStatus();
  const { logoutAsync } = useCloud();
  const addsDevicePhotos = useSyncExternalStore(onRegistryChange, deviceLibraryWaits);
  const finishingFor = useFinishingFor(status.phase === 'pulling' && status.pullStep === 'finishing');

  const { label, failed } = getFirstSyncStep(status, finishingFor);

  // Never sit dead on an error: auto-retry the pull on a short interval while this screen shows an
  // error, and self-heal without the user restarting. (The normal 30s trigger still runs too.)
  useEffect(() => {
    if (!failed) return undefined;
    const id = setInterval(() => requestSync(), RETRY_MS);
    return () => clearInterval(id);
  }, [failed]);

  // Signing out stops the first pull, so it asks first; watchTokenDrops then opens the library to
  // show.
  async function handleSignOut() {
    const message = addsDevicePhotos
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

// How long the finishing step has shown, in ms: 0 until ALMOST_DONE_MS have passed, then at least that
// (a timer can fire a hair early).
function useFinishingFor(finishing: boolean) {
  const [finishingFor, setFinishingFor] = useState(0);
  useEffect(() => {
    if (!finishing) return undefined;
    const since = Date.now();
    const id = setTimeout(() => setFinishingFor(Math.max(ALMOST_DONE_MS, Date.now() - since)), ALMOST_DONE_MS);
    return () => {
      clearTimeout(id);
      setFinishingFor(0);
    };
  }, [finishing]);
  return finishingFor;
}
