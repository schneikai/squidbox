import { useNavigation } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import DetailScrollView from '@/components/DetailScrollView';
import IntroText from '@/components/IntroText';
import Page from '@/components/Page';
import ScreenSectionHeader from '@/components/ScreenSectionHeader';
import Text from '@/components/Text';
import FloatingDetailHeader from '@/components/floating-bars/FloatingDetailHeader';
import { LogBlock, LogEmpty } from '@/components/settings-list/LogBlock';
import { Row, Section } from '@/components/settings-list/SettingsList';
import { SCREEN_PADDING } from '@/constants';
import useAssets from '@/features/assets-context/useAssets';
import SyncErrorViewer from '@/features/cloud-sync/cloud-sync-control/SyncErrorViewer';
import getBackupStatusText from '@/features/cloud-sync/getBackupStatusText';
import useBackupCounts from '@/features/cloud-sync/useBackupCounts';
import useCloudSync from '@/features/cloud-sync/useCloudSync';
import { space } from '@/styles/designTokens';
import { schema } from '@/sync/db/client';
import { readUploadFailures } from '@/sync/readUploadFailures';

const uploadFailuresQuery = { read: readUploadFailures, tables: [schema.assets] };

// Photo backup detail. Uploads the full-res originals to the cloud (S3, via the server). This is a
// manual, resumable action — completed files are marked and skipped on the next run — and only makes
// progress while the app is open (iOS suspends uploads in the background).
export default function BackupScreen() {
  const navigation = useNavigation();
  const cloudSync = useCloudSync();
  const counts = useBackupCounts();
  const { clearSyncErrors } = useAssets();
  const { isSyncing, syncProgressMessage, syncSpeedMessage, backupError, syncNow } = cloudSync;
  const { unsyncedCount, syncErrorCount } = counts;
  const [showErrors, setShowErrors] = useState(false);

  return (
    <Page>
      <FloatingDetailHeader title="Backup" onBack={() => navigation.goBack()} />
      <DetailScrollView>
        <IntroText isScreenIntro>
          Back up your original photos to the cloud. This happens while the app is open — keep it open until it
          finishes.
        </IntroText>

        <Section>
          <Row label="Status" value={getBackupStatusText({ ...cloudSync, ...counts })} />

          {!!backupError && unsyncedCount > 0 && !isSyncing && (
            <View style={styles.panel}>
              <Text variant="error" size="small">
                {backupError}
              </Text>
            </View>
          )}

          {isSyncing && (
            <View style={styles.panel}>
              {syncProgressMessage && (
                <Text variant="hint" tone="primary">
                  {syncProgressMessage.sent} / {syncProgressMessage.total}
                  {'  '}
                  <Text variant="label" tone="primary">
                    {syncProgressMessage.percent}
                  </Text>
                </Text>
              )}
              {syncSpeedMessage && (
                <Text variant="hint" tone="primary">
                  {syncSpeedMessage.now}
                  {'  '}
                  <Text variant="hint">avg {syncSpeedMessage.avg}</Text>
                </Text>
              )}
              <Text variant="hint">Keep the app open until backup finishes.</Text>
            </View>
          )}

          {unsyncedCount > 0 && !isSyncing && <Row label="Back up now" onPress={() => syncNow()} hasChevron />}
          {syncErrorCount > 0 && (
            <Row label="View errors" value={`${syncErrorCount}`} onPress={() => setShowErrors(true)} hasChevron />
          )}
        </Section>

        <ScreenSectionHeader title="Backup log" />
        <LogBlock>
          <LogEmpty text="No runs yet" />
        </LogBlock>

        {showErrors && (
          <SyncErrorViewer
            query={uploadFailuresQuery}
            onRetryAll={clearSyncErrors}
            close={() => setShowErrors(false)}
          />
        )}
      </DetailScrollView>
    </Page>
  );
}

const styles = StyleSheet.create({
  panel: {
    paddingHorizontal: SCREEN_PADDING,
    paddingBottom: space.lg,
    gap: space.xs,
  },
});
