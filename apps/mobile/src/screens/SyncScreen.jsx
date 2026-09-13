import { useNavigation } from '@react-navigation/native';
import { Alert } from 'react-native';

import DetailScrollView from '@/components/DetailScrollView';
import Page from '@/components/Page';
import ScreenSectionHeader from '@/components/ScreenSectionHeader';
import FloatingDetailHeader from '@/components/floating-bars/FloatingDetailHeader';
import { LogBlock, LogEmpty, LogLine } from '@/components/settings-list/LogBlock';
import { Row, Section, SectionFooter } from '@/components/settings-list/SettingsList';
import { useCollectionStats, useOutboxRows, useSyncLogRows } from '@/sync/useInspector';
import { useSyncStatus } from '@/sync/useSyncStatus';
import { requestSync, runClearOutbox, runFullResync } from '@/sync/worker';
import relativeTime from '@/utils/relativeTime';

// Library-sync detail (the metadata engine): a calm status + Sync now for everyday use, troubleshooting
// below, and the raw inspector under "Developer". Records/edges sync automatically in the background.
export default function SyncScreen() {
  const navigation = useNavigation();
  const { phase, pendingCount, cursor, lastPullAt, lastError } = useSyncStatus();
  const stats = useCollectionStats();
  const outbox = useOutboxRows();
  const log = useSyncLogRows();

  function statusText() {
    if (lastError) return "Can't reach server";
    if (phase === 'pushing' || phase === 'pulling') return 'Syncing…';
    return 'Up to date';
  }

  function confirmFullResync() {
    Alert.alert(
      'Rebuild from server?',
      pendingCount > 0
        ? `This rebuilds your local library from the server. You have ${pendingCount} pending change(s) — they'll be pushed first. Your photos are safe.`
        : 'This rebuilds your local library from the server. Your photos are safe.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Rebuild',
          style: 'destructive',
          onPress: () => runFullResync().catch((e) => Alert.alert('Failed', String(e))),
        },
      ],
    );
  }

  function confirmClearOutbox() {
    Alert.alert(
      'Discard pending changes?',
      'Drops local edits that have not synced yet. Can strand never-pushed records.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Discard',
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
        <ScreenSectionHeader title="Status" />
        <Section>
          <Row label="Status" value={statusText()} />
          <Row label="Last synced" value={relativeTime(lastPullAt)} />
        </Section>

        <Section>
          <Row label="Sync now" onPress={() => requestSync()} chevron />
        </Section>

        <ScreenSectionHeader title="Troubleshooting" />
        <Section>
          <Row label="Rebuild from server" onPress={confirmFullResync} destructive chevron />
        </Section>
        <SectionFooter>
          Rebuild your local library from the server if something looks wrong. Your photos are safe.
        </SectionFooter>

        <ScreenSectionHeader title="Developer" />
        <Section>
          <Row label="Cursor" value={String(cursor)} />
          <Row label="Pending changes" value={String(pendingCount)} />
          {stats.map((s) => (
            <Row key={s.name} label={s.name} value={`${s.records} · ${s.pending} pending · ${s.tombstones} tomb`} />
          ))}
        </Section>
        <Section>
          <Row label="Clear outbox" value={`${outbox.length}`} onPress={confirmClearOutbox} destructive chevron />
        </Section>

        <ScreenSectionHeader title="Sync log" />
        <LogBlock>
          {log.length === 0 ? (
            <LogEmpty text="No runs yet" />
          ) : (
            log.map((l) => (
              <LogLine
                key={l.id}
                primary={`${new Date(l.ranAt).toLocaleTimeString()} · ↑${l.pushed} ↓${l.pulled} · ${l.durationMs}ms`}
                secondary={l.notes ?? undefined}
                error={l.error ?? undefined}
              />
            ))
          )}
        </LogBlock>
      </DetailScrollView>
    </Page>
  );
}
