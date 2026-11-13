import { useNavigation } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet } from 'react-native';

import DetailScrollView from '@/components/DetailScrollView';
import Page from '@/components/Page';
import ScreenSectionHeader from '@/components/ScreenSectionHeader';
import FloatingDetailHeader from '@/components/floating-bars/FloatingDetailHeader';
import { LogBlock, LogEmpty, LogLine } from '@/components/settings-list/LogBlock';
import { Row, Section, SectionFooter } from '@/components/settings-list/SettingsList';
import SyncErrorViewer from '@/features/cloud-sync/cloud-sync-control/SyncErrorViewer';
import UpdateRequiredNote from '@/features/sync-status/UpdateRequiredNote';
import useLibrarySyncStatusText from '@/features/sync-status/useLibrarySyncStatusText';
import { space } from '@/styles/designTokens';
import { type CollectionTable, clientCollectionTables } from '@/sync/clientCollections';
import { getDb, schema } from '@/sync/db/client';
import { retryFailures } from '@/sync/outbox';
import { type PushFailure, readPushFailures } from '@/sync/readPushFailures';
import { usePendingByCollection, useSyncLogRows } from '@/sync/useInspector';
import type { PagedQuery } from '@/sync/usePagedQuery';
import { useRecordCounts } from '@/sync/useRecordCounts';
import { useSyncStatus } from '@/sync/useSyncStatus';
import { requestSync, runClearOutbox, runFullResync } from '@/sync/worker';
import confirmAsync from '@/utils/confirmAsync';
import relativeTime from '@/utils/relativeTime';

const pushFailuresQuery: PagedQuery<PushFailure> = { read: readPushFailures, tables: [schema.outbox] };

// Library-sync detail (the metadata engine): a calm status + Sync now for everyday use, troubleshooting
// below, and the raw inspector under "Developer". Records/edges sync automatically in the background.
export default function SyncScreen() {
  const navigation = useNavigation();
  const syncStatus = useSyncStatus();
  const { pendingCount, failedCount, cursor, lastPullAt } = syncStatus;
  const pendingByCollection = usePendingByCollection();
  const log = useSyncLogRows();
  const [showErrors, setShowErrors] = useState(false);
  const statusText = useLibrarySyncStatusText(syncStatus);

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
        <UpdateRequiredNote style={styles.updateNote} />
        <ScreenSectionHeader title="Status" />
        <Section>
          <Row label="Status" value={statusText} />
          <Row label="Last synced" value={relativeTime(lastPullAt)} />
          {failedCount > 0 && <Row label="View errors" onPress={() => setShowErrors(true)} hasChevron />}
          <Row label="Sync now" onPress={() => requestSync()} hasChevron />
        </Section>

        <ScreenSectionHeader title="Developer" />
        <Section>
          <Row label="Cursor" value={String(cursor)} />
          <Row label="Pending changes" value={String(pendingCount)} />
          {Object.entries(clientCollectionTables).map(([name, table]) => (
            <CollectionRow key={name} name={name} table={table} pending={pendingByCollection.get(name) ?? 0} />
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

type CollectionRowProps = { name: string; table: CollectionTable; pending: number };

// One collection's records, pending changes and tombstones; each row watches only its own table.
function CollectionRow({ name, table, pending }: CollectionRowProps) {
  const { records, tombstones } = useRecordCounts(table);
  return <Row label={name} value={`${records} · ${pending} pending · ${tombstones} tomb`} />;
}

const styles = StyleSheet.create({
  updateNote: { marginTop: space.sm },
});
