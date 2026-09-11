import { sql } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { getDb, schema } from '@/sync/db/client';
import { colors } from '@/styles/designTokens';

// Shown once, right after the first login, while the initial library pull runs. Gating the app
// behind this (a) tells the user it's intentional and one-time, and (b) keeps the heavy asset
// grids unmounted during the bulk load so the sync isn't fighting the UI. Uses COUNT(*) (cheap,
// live) rather than loading rows.
function useCount(table) {
  const { data } = useLiveQuery(getDb().select({ n: sql`count(*)` }).from(table));
  return Number(data?.[0]?.n ?? 0);
}

export default function FirstSyncScreen() {
  const assets = useCount(schema.assets);
  const albums = useCount(schema.albums);
  const posts = useCount(schema.posts);

  return (
    <View style={styles.root}>
      <LinearGradient colors={colors.appBackground} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.title}>Setting up your library</Text>
        <Text style={styles.subtitle}>Downloading your photos, albums and posts. This happens once.</Text>
        <Text style={styles.count}>
          {assets.toLocaleString()} photos · {albums.toLocaleString()} albums · {posts.toLocaleString()} posts
        </Text>
        <Text style={styles.hint}>Please keep the app open — it'll finish shortly.</Text>
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
});
