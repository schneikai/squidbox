import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';

import { useSyncStatus } from '@/sync/useSyncStatus';
import { useCollectionStats, useOutboxRows, useSyncLogRows } from '@/sync/useInspector';
import { requestSync, runFullResync, runClearOutbox } from '@/sync/worker';

// The Sync Inspector (dev) — replacement for "looking at the JSON files" (sync-design §13).
// Registry-driven collection stats (assets, albums, posts), outbox, sync log
// with conflict/rebase notes, and the Sync now / Full resync / Clear outbox actions.
export default function SyncInspector() {
  const { phase, pendingCount, cursor, lastPullAt, lastError } = useSyncStatus();
  const stats = useCollectionStats();
  const outbox = useOutboxRows();
  const log = useSyncLogRows();

  function confirmFullResync() {
    Alert.alert(
      'Full resync?',
      pendingCount > 0
        ? `Wipes local tables and repulls from scratch. You have ${pendingCount} pending change(s) — they'll be pushed first, but this rebuilds local state from the server.`
        : 'Wipes local tables and repulls from the server (cursor = 0).',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Resync', style: 'destructive', onPress: () => runFullResync().catch((e) => Alert.alert('Failed', String(e))) },
      ],
    );
  }
  function confirmClearOutbox() {
    Alert.alert('Clear outbox?', 'Discards pending local changes that have not synced. Can strand never-pushed records.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => runClearOutbox().catch((e) => Alert.alert('Failed', String(e))) },
    ]);
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Sync Inspector</Text>
        <Text style={[styles.badge, phase === 'error' && styles.error]}>{phase}</Text>
      </View>
      <Text style={styles.meta}>
        cursor {cursor} · pending {pendingCount}
        {lastPullAt ? ` · pulled ${new Date(lastPullAt).toLocaleTimeString()}` : ''}
      </Text>
      {lastError ? <Text style={[styles.meta, styles.error]}>error: {lastError}</Text> : null}

      <View style={styles.actions}>
        <Btn label="Sync now" onPress={() => requestSync()} />
        <Btn label="Full resync" onPress={confirmFullResync} tone="warn" />
        <Btn label="Clear outbox" onPress={confirmClearOutbox} tone="warn" />
      </View>

      <Section title="Collections">
        {stats.map((s) => (
          <Text key={s.name} style={styles.row}>
            {s.name}: {s.records} records · {s.pending} pending · {s.tombstones} tombstones
          </Text>
        ))}
      </Section>

      <Section title={`Outbox (${outbox.length})`}>
        {outbox.length === 0 ? (
          <Text style={styles.muted}>empty</Text>
        ) : (
          outbox.slice(0, 20).map((o) => (
            <Text key={o.id} style={styles.row}>
              {o.collection}/{o.op} {String(o.recordId).slice(0, 8)}… @{o.updatedAt}
            </Text>
          ))
        )}
      </Section>

      <Section title="Sync log">
        {log.length === 0 ? (
          <Text style={styles.muted}>no runs yet</Text>
        ) : (
          log.map((l) => (
            <View key={l.id} style={styles.logItem}>
              <Text style={styles.row}>
                {new Date(l.ranAt).toLocaleTimeString()} · ↑{l.pushed} ↓{l.pulled} · {l.durationMs}ms
                {l.error ? ' · ERROR' : ''}
              </Text>
              {l.notes ? <Text style={styles.note}>{l.notes}</Text> : null}
              {l.error ? <Text style={[styles.note, styles.error]}>{l.error}</Text> : null}
            </View>
          ))
        )}
      </Section>
    </View>
  );
}

function Btn({ label, onPress, tone }) {
  return (
    <TouchableOpacity style={[styles.btn, tone === 'warn' && styles.btnWarn]} onPress={onPress}>
      <Text style={styles.btnText}>{label}</Text>
    </TouchableOpacity>
  );
}
function Section({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderColor: 'teal', borderWidth: 1, borderRadius: 8, padding: 10, gap: 8 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontWeight: '700', fontSize: 16 },
  badge: { fontVariant: ['tabular-nums'], color: 'teal', fontWeight: '600' },
  meta: { color: '#555', fontVariant: ['tabular-nums'] },
  error: { color: 'red' },
  actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  btn: { backgroundColor: 'teal', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6 },
  btnWarn: { backgroundColor: '#c26a00' },
  btnText: { color: 'white', fontWeight: '600' },
  section: { gap: 2 },
  sectionTitle: { fontWeight: '600', marginTop: 4 },
  row: { fontVariant: ['tabular-nums'], color: '#222' },
  muted: { color: '#999' },
  logItem: { marginBottom: 2 },
  note: { color: '#c26a00', fontSize: 12 },
});
