import { useNavigation } from '@react-navigation/native';
import { Alert, StyleSheet, Text, View } from 'react-native';

import DetailScrollView from '@/components/DetailScrollView';
import Page from '@/components/Page';
import ScreenSectionHeader from '@/components/ScreenSectionHeader';
import FloatingDetailHeader from '@/components/floating-bars/FloatingDetailHeader';
import { Row, Section } from '@/components/settings-list/SettingsList';
import { SCREEN_PADDING } from '@/constants';
import { colors, typography } from '@/styles/designTokens';
import { useCollectionStats, useOutboxRows, useSyncLogRows } from '@/sync/useInspector';
import { useSyncStatus } from '@/sync/useSyncStatus';
import { requestSync, runClearOutbox, runFullResync } from '@/sync/worker';

// Library-sync detail (the metadata engine). Records/edges sync automatically in the background;
// this is the inspector + manual controls (sync-design §13).
export default function SyncScreen() {
  const navigation = useNavigation();
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
        {
          text: 'Resync',
          style: 'destructive',
          onPress: () => runFullResync().catch((e) => Alert.alert('Failed', String(e))),
        },
      ],
    );
  }

  function confirmClearOutbox() {
    Alert.alert(
      'Clear outbox?',
      'Discards pending local changes that have not synced. Can strand never-pushed records.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => runClearOutbox().catch((e) => Alert.alert('Failed', String(e))),
        },
      ],
    );
  }

  return (
    <Page>
      <FloatingDetailHeader title="Library sync" onBack={() => navigation.goBack()} />
      <DetailScrollView>
        <Section>
          <Row label="Status" value={phase} />
          <Row label="Pending changes" value={String(pendingCount)} />
          <Row label="Cursor" value={String(cursor)} />
          {lastPullAt ? <Row label="Last pull" value={new Date(lastPullAt).toLocaleTimeString()} /> : null}
          {lastError ? <Row label="Error" value={lastError} destructive /> : null}
        </Section>

        <Section>
          <Row label="Sync now" onPress={() => requestSync()} chevron />
          <Row label="Full resync" onPress={confirmFullResync} destructive chevron />
          <Row label="Clear outbox" onPress={confirmClearOutbox} destructive chevron />
        </Section>

        <ScreenSectionHeader title="Collections" />
        <Section>
          {stats.map((s) => (
            <Row key={s.name} label={s.name} value={`${s.records} · ${s.pending} pending · ${s.tombstones} tomb`} />
          ))}
        </Section>

        <ScreenSectionHeader title={`Outbox (${outbox.length})`} />
        <View style={styles.log}>
          {outbox.length === 0 ? (
            <Text style={styles.muted}>empty</Text>
          ) : (
            outbox.slice(0, 20).map((o) => (
              <Text key={o.id} style={styles.line}>
                {o.collection}/{o.op} {String(o.recordId).slice(0, 8)}… @{o.updatedAt}
              </Text>
            ))
          )}
        </View>

        <ScreenSectionHeader title="Sync log" />
        <View style={styles.log}>
          {log.length === 0 ? (
            <Text style={styles.muted}>no runs yet</Text>
          ) : (
            log.map((l) => (
              <View key={l.id} style={styles.logItem}>
                <Text style={styles.line}>
                  {new Date(l.ranAt).toLocaleTimeString()} · ↑{l.pushed} ↓{l.pulled} · {l.durationMs}ms
                  {l.error ? ' · ERROR' : ''}
                </Text>
                {l.notes ? <Text style={styles.note}>{l.notes}</Text> : null}
                {l.error ? <Text style={[styles.note, styles.error]}>{l.error}</Text> : null}
              </View>
            ))
          )}
        </View>
      </DetailScrollView>
    </Page>
  );
}

const styles = StyleSheet.create({
  log: { paddingHorizontal: SCREEN_PADDING, paddingBottom: 12, gap: 2 },
  line: { fontSize: typography.sm, color: colors.text, fontVariant: ['tabular-nums'] },
  muted: { color: colors.textTertiary },
  logItem: { marginBottom: 2 },
  note: { color: colors.warning ?? '#c26a00', fontSize: typography.xs ?? 12 },
  error: { color: colors.danger },
});
