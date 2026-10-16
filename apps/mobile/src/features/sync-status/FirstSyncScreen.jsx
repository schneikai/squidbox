import { useEffect } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import StatusScreen from '@/components/StatusScreen';
import useCloud from '@/features/cloud/useCloud';
import { schema } from '@/sync/db/client';
import { useRecordCounts } from '@/sync/useRecordCounts';
import { useSyncStatus } from '@/sync/useSyncStatus';
import { requestSync } from '@/sync/worker';

// Shown once, right after the first login, while the initial library pull runs. Gating the app
// behind this (a) tells the user it's intentional and one-time, and (b) keeps the heavy asset
// grids unmounted during the bulk load so the sync isn't fighting the UI. Shows live counts, not rows.
const RETRY_MS = 5_000;

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

  const hasError = phase === 'error' && !!lastError;
  const started = assets + albums + posts > 0;

  // Never sit dead on an error: auto-retry the pull on a short interval while this screen shows an
  // error, and self-heal without the user restarting. (The normal 30s trigger still runs too.)
  useEffect(() => {
    if (!hasError) return undefined;
    const id = setInterval(() => requestSync(), RETRY_MS);
    return () => clearInterval(id);
  }, [hasError]);

  return (
    <StatusScreen busy={!hasError} title={hasError ? "Can't reach the server" : 'Setting up your library'}>
      {hasError ? (
        <>
          <Text style={styles.subtitle}>
            We'll keep trying automatically. Check your connection — your data is safe.
          </Text>
          {started ? (
            <Text style={styles.count}>
              {assets.toLocaleString()} photos · {albums.toLocaleString()} albums · {posts.toLocaleString()} posts so
              far
            </Text>
          ) : null}
          <Pressable style={styles.retry} onPress={() => requestSync()} hitSlop={8}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={styles.subtitle}>
            {started ? 'Downloading your photos, albums and posts. This happens once.' : 'Connecting to your library…'}
          </Text>
          {started ? (
            <Text style={styles.count}>
              {assets.toLocaleString()} photos · {albums.toLocaleString()} albums · {posts.toLocaleString()} posts
            </Text>
          ) : null}
          <Text style={styles.hint}>Please keep the app open — it'll finish shortly.</Text>
        </>
      )}
      {/* A sign-out stops the pull at its next batch; the library stays open with what it pulled. */}
      <Pressable style={styles.signout} onPress={() => logoutAsync()} hitSlop={8}>
        <Text style={styles.signoutText}>Sign out</Text>
      </Pressable>
    </StatusScreen>
  );
}

const styles = StyleSheet.create({
  subtitle: { fontSize: 15, opacity: 0.7, textAlign: 'center' },
  count: { fontSize: 16, fontWeight: '600', marginTop: 8, textAlign: 'center' },
  hint: { fontSize: 13, opacity: 0.5, textAlign: 'center', marginTop: 4 },
  retry: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  retryText: { fontSize: 16, fontWeight: '600' },
  signout: { marginTop: 4, paddingHorizontal: 24, paddingVertical: 10 },
  signoutText: { fontSize: 15, opacity: 0.6 },
});
