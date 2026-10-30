import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { Alert } from 'react-native';

import DetailScrollView from '@/components/DetailScrollView';
import Page from '@/components/Page';
import ScreenSectionHeader from '@/components/ScreenSectionHeader';
import FloatingDetailHeader from '@/components/floating-bars/FloatingDetailHeader';
import { LogBlock, LogEmpty, LogLine } from '@/components/settings-list/LogBlock';
import { Row, Section, SectionFooter } from '@/components/settings-list/SettingsList';
import SyncErrorViewer from '@/features/cloud-sync/cloud-sync-control/SyncErrorViewer';
import { getDb, schema } from '@/sync/db/client';
import { retryFailures } from '@/sync/outbox';
import { readPushFailures } from '@/sync/readPushFailures';
import { useCollectionStats, useSyncLogRows } from '@/sync/useInspector';
import { useSyncStatus } from '@/sync/useSyncStatus';
import { requestSync, runClearOutbox, runFullResync } from '@/sync/worker';
import confirmAsync from '@/utils/confirmAsync';
import formatErrorCount from '@/utils/formatErrorCount';
import relativeTime from '@/utils/relativeTime';

const pushFailuresQuery = { read: readPushFailures, tables: [schema.outbox] };

// Library-sync detail (the metadata engine): a calm status + Sync now for everyday use, troubleshooting
// below, and the raw inspector under "Developer". Records/edges sync automatically in the background.
export default function SyncScreen() {
  const navigation = useNavigation();
  const { phase, pendingCount, failedCount, cursor, lastPullAt, lastError } = useSyncStatus();
  const stats = useCollectionStats();
  const log = useSyncLogRows();
  const [showErrors, setShowErrors] = useState(false);

  function statusText() {
    if (lastError) return "Can't reach server";
    if (phase === 'pushing' || phase === 'pulling') return 'Syncing…';
    if (failedCount > 0) return formatErrorCount(failedCount);
    return 'Up to date';
  }

  async function retryAll() {
    await retryFailures(getDb());
    requestSync();
  }

  async function confirmFullResync() {
    const title = 'Rebuild from server?';
    const message =
      pendingCount > 0
        ? `This rebuilds your local library from the server. You have ${pendingCount} pending change(s) — they'll be pushed first. Your photos are safe.`
        : 'This rebuilds your local library from the server. Your photos are safe.';
    if (!(await confirmAsync({ title, message, action: 'Rebuild', destructive: true }))) return;
    runFullResync().catch((e) => Alert.alert('Failed', String(e)));
  }

  async function confirmClearOutbox() {
    const message = 'Drops local edits that have not synced yet. Can strand never-pushed records.';
    if (!(await confirmAsync({ title: 'Discard pending changes?', message, action: 'Discard', destructive: true }))) {
      return;
    }
    runClearOutbox(getDb()).catch((e) => Alert.alert('Failed', String(e)));
  }

  return (
    <Page>
      <FloatingDetailHeader title="Library sync" onBack={() => navigation.goBack()} />
      <DetailScrollView>
        <ScreenSectionHeader title="Status" />
        <Section>
          <Row label="Status" value={statusText()} />
          <Row label="Last synced" value={relativeTime(lastPullAt)} />
          {failedCount > 0 && <Row label="View errors" onPress={() => setShowErrors(true)} hasChevron />}
          <Row label="Sync now" onPress={() => requestSync()} hasChevron />
        </Section>

        <ScreenSectionHeader title="Developer" />
        <Section>
          <Row label="Cursor" value={String(cursor)} />
          <Row label="Pending changes" value={String(pendingCount)} />
          {stats.map((s) => (
            <Row key={s.name} label={s.name} value={`${s.records} · ${s.pending} pending · ${s.tombstones} tomb`} />
          ))}
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

        <ScreenSectionHeader title="Troubleshooting" />
        <Section>
          <Row label="Rebuild from server" onPress={confirmFullResync} colorPalette="danger" hasChevron />
          <Row
            label="Clear outbox"
            value={`${pendingCount}`}
            onPress={confirmClearOutbox}
            colorPalette="danger"
            hasChevron
          />
        </Section>
        <SectionFooter>
          Rebuild your library from the server if something looks wrong — your photos are safe. Only clear the outbox if
          a sync stays stuck.
        </SectionFooter>

        {showErrors && (
          <SyncErrorViewer query={pushFailuresQuery} onRetryAll={retryAll} close={() => setShowErrors(false)} />
        )}
      </DetailScrollView>
    </Page>
  );
}
