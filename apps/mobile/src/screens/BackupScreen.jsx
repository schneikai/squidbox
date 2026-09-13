import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import DetailScrollView from '@/components/DetailScrollView';
import Page from '@/components/Page';
import ScreenSectionHeader from '@/components/ScreenSectionHeader';
import { LogBlock, LogEmpty } from '@/components/settings-list/LogBlock';
import { Row, Section } from '@/components/settings-list/SettingsList';
import FloatingDetailHeader from '@/components/floating-bars/FloatingDetailHeader';
import { SCREEN_PADDING } from '@/constants';
import SyncErrorViewer from '@/features/cloud-sync/cloud-sync-control/SyncErrorViewer';
import useCloudSync from '@/features/cloud-sync/useCloudSync';
import { colors, typography } from '@/styles/designTokens';

// Photo backup detail. Uploads the full-res originals to the cloud (S3, via the server). This is a
// manual, resumable action — completed files are marked and skipped on the next run — and only makes
// progress while the app is open (iOS suspends uploads in the background).
export default function BackupScreen() {
  const navigation = useNavigation();
  const {
    isSyncing,
    syncMessage,
    syncProgressMessage,
    syncSpeedMessage,
    unsyncedAssets,
    assetsWithSyncErrors,
    syncNow,
  } = useCloudSync();
  const [showErrors, setShowErrors] = useState(false);

  function statusText() {
    if (isSyncing) return syncMessage ?? 'Backing up…';
    if (assetsWithSyncErrors.length > 0)
      return `${assetsWithSyncErrors.length} error${assetsWithSyncErrors.length > 1 ? 's' : ''}`;
    if (unsyncedAssets.length > 0) return `${unsyncedAssets.length} not backed up`;
    return 'All backed up';
  }

  return (
    <Page>
      <FloatingDetailHeader title="Backup" onBack={() => navigation.goBack()} />
      <DetailScrollView>
        <Text style={styles.intro}>
          Back up your original photos to the cloud. This happens while the app is open — keep it open until it
          finishes.
        </Text>

        <Section>
          <Row label="Status" value={statusText()} />

          {isSyncing && (
            <View style={styles.panel}>
              {syncProgressMessage && (
                <Text style={styles.line}>
                  {syncProgressMessage.sent} / {syncProgressMessage.total}
                  {'  '}
                  <Text style={styles.bold}>{syncProgressMessage.percent}</Text>
                </Text>
              )}
              {syncSpeedMessage && (
                <Text style={styles.line}>
                  {syncSpeedMessage.now}
                  {'  '}
                  <Text style={styles.muted}>avg {syncSpeedMessage.avg}</Text>
                </Text>
              )}
              <Text style={styles.muted}>Keep the app open until backup finishes.</Text>
            </View>
          )}

          {unsyncedAssets.length > 0 && !isSyncing && <Row label="Back up now" onPress={() => syncNow()} chevron />}
          {assetsWithSyncErrors.length > 0 && (
            <Row
              label="View errors"
              value={`${assetsWithSyncErrors.length}`}
              onPress={() => setShowErrors(true)}
              chevron
            />
          )}
        </Section>

        <ScreenSectionHeader title="Backup log" />
        <LogBlock>
          <LogEmpty text="No runs yet" />
        </LogBlock>

        {showErrors && (
          <SyncErrorViewer assetsWithSyncErrors={assetsWithSyncErrors} close={() => setShowErrors(false)} />
        )}
      </DetailScrollView>
    </Page>
  );
}

const styles = StyleSheet.create({
  intro: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    paddingHorizontal: SCREEN_PADDING,
    paddingBottom: 12,
    lineHeight: 18,
  },
  panel: {
    paddingHorizontal: SCREEN_PADDING,
    paddingBottom: 15,
    gap: 4,
  },
  line: { fontSize: typography.sm, color: colors.text, lineHeight: 18 },
  bold: { fontWeight: '600', color: colors.text },
  muted: { color: colors.textSecondary },
});
