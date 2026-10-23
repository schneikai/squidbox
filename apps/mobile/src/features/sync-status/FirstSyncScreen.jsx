import { useEffect, useSyncExternalStore } from 'react';
import { StyleSheet, Text } from 'react-native';

import StatusScreen from '@/components/StatusScreen';
import TextButton from '@/components/TextButton';
import useCloud from '@/features/cloud/useCloud';
import { onRegistryChange } from '@/library/registry';
import { deviceLibraryToJoin } from '@/library/sessionLibrary';
import { schema } from '@/sync/db/client';
import { useRecordCounts } from '@/sync/useRecordCounts';
import { useSyncStatus } from '@/sync/useSyncStatus';
import { requestSync } from '@/sync/worker';
import confirmAsync from '@/utils/confirmAsync';

// Shown once, right after the first login, while the initial library pull runs. Gating the app
// behind this (a) tells the user it's intentional and one-time, and (b) keeps the heavy asset
// grids unmounted during the bulk load so the sync isn't fighting the UI. Shows live counts, not rows.
const RETRY_MS = 5_000;

// Whether this device's library waits to join the open one: every merge waits for the first pull
// (mergeWaits in library/mergeLibrary.ts).
const deviceLibraryWaits = () => Boolean(deviceLibraryToJoin());

function useTotal(table) {
  const { records, tombstones } = useRecordCounts(table);
  return records + tombstones;
}

export default function FirstSyncScreen() {
  const assets = useTotal(schema.assets);
  const albums = useTotal(schema.albums);
  const posts = useTotal(schema.posts);
  const { phase, lastError } = useSyncStatus();
  const { logoutAsync } = useCloud();
  const addsDevicePhotos = useSyncExternalStore(onRegistryChange, deviceLibraryWaits);

  const hasError = phase === 'error' && !!lastError;
  const started = assets + albums + posts > 0;
  const counts = `${assets.toLocaleString()} photos · ${albums.toLocaleString()} albums · ${posts.toLocaleString()} posts`;

  // Never sit dead on an error: auto-retry the pull on a short interval while this screen shows an
  // error, and self-heal without the user restarting. (The normal 30s trigger still runs too.)
  useEffect(() => {
    if (!hasError) return undefined;
    const id = setInterval(() => requestSync(), RETRY_MS);
    return () => clearInterval(id);
  }, [hasError]);

  // Signing out stops the first pull, so it asks first; watchTokenDrops then opens the library to
  // show.
  async function handleSignOut() {
    const message = addsDevicePhotos
      ? 'This iPhone’s photos stay here and join your account the next time you sign in.'
      : 'Setting up your library goes on the next time you sign in.';
    const title = 'Sign out before setup finishes?';
    if (await confirmAsync({ title, message, action: 'Sign Out', destructive: true })) await logoutAsync();
  }

  function subtitle() {
    if (hasError) return "We'll keep trying automatically. Check your connection — your data is safe.";
    return started ? 'Downloading your photos, albums and posts. This happens once.' : 'Connecting to your library…';
  }

  return (
    <StatusScreen busy={!hasError} title={hasError ? "Can't reach the server" : 'Setting up your library'}>
      <Text style={styles.subtitle}>{subtitle()}</Text>
      {started && <Text style={styles.count}>{hasError ? `${counts} so far` : counts}</Text>}
      {hasError ? (
        <TextButton label="Try again" onPress={() => requestSync()} />
      ) : (
        <Text style={styles.hint}>Please keep the app open — it'll finish shortly.</Text>
      )}
      {addsDevicePhotos && <Text style={styles.hint}>This iPhone’s photos are added once this is done.</Text>}
      {/* A sign-out stops the pull at its next batch; the library keeps what it pulled. */}
      <TextButton label="Sign out" onPress={handleSignOut} tone="muted" />
    </StatusScreen>
  );
}

const styles = StyleSheet.create({
  subtitle: { fontSize: 15, opacity: 0.7, textAlign: 'center' },
  count: { fontSize: 16, fontWeight: '600', marginTop: 8, textAlign: 'center' },
  hint: { fontSize: 13, opacity: 0.5, textAlign: 'center', marginTop: 4 },
});
