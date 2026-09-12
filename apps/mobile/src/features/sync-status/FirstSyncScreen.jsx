import { sql } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/styles/designTokens';
import { getDb, schema } from '@/sync/db/client';
import { useSyncStatus } from '@/sync/useSyncStatus';
import { requestSync } from '@/sync/worker';

// Shown once, right after the first login, while the initial library pull runs. Gating the app
// behind this (a) tells the user it's intentional and one-time, and (b) keeps the heavy asset
// grids unmounted during the bulk load so the sync isn't fighting the UI. Uses COUNT(*) (cheap,
// live) rather than loading rows.
function useCount(table) {
  const { data } = useLiveQuery(
    getDb()
      .select({ n: sql`count(*)` })
      .from(table),
  );
  return Number(data?.[0]?.n ?? 0);
}

const RETRY_MS = 5_000;

export default function FirstSyncScreen() {
  const assets = useCount(schema.assets);
  const albums = useCount(schema.albums);
  const posts = useCount(schema.posts);
  const { phase, lastError } = useSyncStatus();

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
    <View style={styles.root}>
      <LinearGradient
        colors={colors.appBackground}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.center}>
        {hasError ? (
          <>
            <Text style={styles.title}>Can't reach the server</Text>
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
            <ActivityIndicator size="large" />
            <Text style={styles.title}>Setting up your library</Text>
            <Text style={styles.subtitle}>
              {started
                ? 'Downloading your photos, albums and posts. This happens once.'
                : 'Connecting to your library…'}
            </Text>
            {started ? (
              <Text style={styles.count}>
                {assets.toLocaleString()} photos · {albums.toLocaleString()} albums · {posts.toLocaleString()} posts
              </Text>
            ) : null}
            <Text style={styles.hint}>Please keep the app open — it'll finish shortly.</Text>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 12 },
  title: { fontSize: 22, fontWeight: '700', marginTop: 8, textAlign: 'center' },
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
});
