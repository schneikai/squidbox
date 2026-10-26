import { useNavigation } from '@react-navigation/native';
import { useTransition } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';

import DetailScrollView from '@/components/DetailScrollView';
import LoginForm from '@/components/LoginForm';
import Page from '@/components/Page';
import ScreenSectionHeader from '@/components/ScreenSectionHeader';
import Switch from '@/components/Switch';
import FloatingDetailHeader from '@/components/floating-bars/FloatingDetailHeader';
import useProgressOverlay from '@/components/progress-overlay/useProgressOverlay';
import { Row, Section, SectionFooter } from '@/components/settings-list/SettingsList';
import useAppSettings from '@/features/app-settings/useAppSettings';
import confirmBackupSignOutAsync from '@/features/cloud/confirmBackupSignOutAsync';
import useCloud from '@/features/cloud/useCloud';
import getBackupStatusText from '@/features/cloud-sync/getBackupStatusText';
import useBackupCounts from '@/features/cloud-sync/useBackupCounts';
import useCloudSync from '@/features/cloud-sync/useCloudSync';
import useHasFeature from '@/hooks/useHasFeature';
import useIsAssistantAvailable from '@/hooks/useIsAssistantAvailable';
import useLibrary from '@/library/useLibrary';
import { colors } from '@/styles/designTokens';
import { useSyncStatus } from '@/sync/useSyncStatus';
import { SERVER_URL } from '@/utils/cloud-api/apiBaseUrl';
import confirmAsync from '@/utils/confirmAsync';
import formatErrorCount from '@/utils/formatErrorCount';
import useResortAlbumsByName from '@/utils/tools/useResortAlbumsByName';

export default function SettingsScreen() {
  const navigation = useNavigation();
  const { isAuthenticated, needsReauth, user, logoutAsync } = useCloud();
  const { library } = useLibrary();
  const cloudSync = useCloudSync();
  const counts = useBackupCounts();
  const { phase, lastError, pendingCount, failedCount } = useSyncStatus();
  const { isVideoAutoplayOn, setIsVideoAutoplayOn, isHapticsOn, setIsHapticsOn } = useAppSettings();
  const isAssistantAvailable = useIsAssistantAvailable();
  const canManageFeatures = useHasFeature('manage_features');

  const [isLoggingOut, startLogoutTransition] = useTransition();

  const { showBlocking, hide } = useProgressOverlay();
  const resortAlbumsByNameAsync = useResortAlbumsByName();

  // An account library shows its backup whether or not its owner is signed in right now.
  const isAccountLibrary = library.owner.kind === 'account';

  // The confirmation is asked outside the transition: a state update made inside its callback
  // before the first await would be part of the pending transition and never render the alert.
  async function handleLogout() {
    if (await confirmBackupSignOutAsync({ pendingCount, ...counts })) startLogoutTransition(() => logoutAsync());
  }

  async function handleResortAlbums() {
    const message =
      'Reorders numbered albums from highest to lowest (e.g. 230, 220, 210). Albums without a numeric name stay where they are.';
    if (!(await confirmAsync({ title: 'Sort albums by name?', message, action: 'Sort' }))) return;
    try {
      showBlocking();
      const count = await resortAlbumsByNameAsync();
      Alert.alert('Done!', `Sorted ${count} album${count === 1 ? '' : 's'}.`);
    } catch (error) {
      Alert.alert('Failed', error.message);
    } finally {
      hide();
    }
  }

  async function handleCheckApi() {
    try {
      const response = await fetch(`${SERVER_URL}/up`);
      if (response.ok) {
        Alert.alert('API reachable', SERVER_URL);
      } else {
        Alert.alert('API error', `Status: ${response.status}\n${SERVER_URL}`);
      }
    } catch (error) {
      Alert.alert('API unreachable', `${error.message}\n${SERVER_URL}`);
    }
  }

  // Backup = uploading full-res photo files to the cloud (manual). Library sync = the metadata
  // engine (automatic). Each is one tappable status row → its own detail screen.
  function librarySyncStatusText() {
    if (needsReauth) return pendingCount > 0 ? `${pendingCount} waiting for sign-in` : 'Up to date';
    if (lastError) return 'Error';
    if (phase === 'pushing' || phase === 'pulling') return 'Syncing…';
    if (failedCount > 0) return formatErrorCount(failedCount);
    if (pendingCount > 0) return `${pendingCount} pending`;
    return 'Up to date';
  }

  function renderAccount() {
    if (isAuthenticated) {
      return (
        <Section>
          <Row label="Signed in as" value={user?.email} />
          <Row label="Sign out" onPress={isLoggingOut ? undefined : handleLogout} destructive chevron={!isLoggingOut}>
            {isLoggingOut && <ActivityIndicator size="small" color={colors.status.danger} />}
          </Row>
        </Section>
      );
    }
    return (
      <>
        {needsReauth && (
          <Section>
            <Row label="Backup paused" value="Sign in to continue" />
          </Section>
        )}
        <View style={styles.loginWrapper}>
          <LoginForm ownerEmail={needsReauth ? user?.email : undefined} />
        </View>
        {!isAccountLibrary && (
          <SectionFooter>
            Squidbox works without an account. Sign in to back up your photos and keep them in sync.
          </SectionFooter>
        )}
      </>
    );
  }

  return (
    <Page>
      <FloatingDetailHeader title="Settings" onBack={() => navigation.goBack()} />
      <DetailScrollView>
        <ScreenSectionHeader title="Account" />
        {renderAccount()}

        {isAccountLibrary && (
          <>
            <ScreenSectionHeader title="Backup & Sync" />
            <Section>
              <Row
                label="Photo backup"
                value={getBackupStatusText({ ...cloudSync, ...counts, needsReauth })}
                onPress={() => navigation.navigate('BackupScreen')}
                chevron
              />
              <Row
                label="Library sync"
                value={librarySyncStatusText()}
                onPress={() => navigation.navigate('SyncScreen')}
                chevron
              />
            </Section>
          </>
        )}

        {isAssistantAvailable && (
          // A section of its own row, without a header to repeat it.
          <Section isHeaderless>
            <Row label="Assistant" onPress={() => navigation.navigate('AssistantScreen')} chevron />
          </Section>
        )}

        <ScreenSectionHeader title="Videos" />
        <Section>
          <Row label="Autoplay">
            <Switch
              value={isVideoAutoplayOn}
              onValueChange={setIsVideoAutoplayOn}
              accessibilityLabel="Autoplay videos"
            />
          </Row>
        </Section>

        <ScreenSectionHeader title="Feedback" />
        <Section>
          <Row label="Haptics">
            <Switch value={isHapticsOn} onValueChange={setIsHapticsOn} accessibilityLabel="Haptics" />
          </Row>
        </Section>
        <SectionFooter>
          Gentle taps you can feel when you pick up or drop a photo or album, peek at a photo, or when something is
          saved or goes wrong.
        </SectionFooter>

        <ScreenSectionHeader title="Data" />
        <Section>
          <Row label="Sort albums by name" onPress={handleResortAlbums} chevron />
        </Section>

        <ScreenSectionHeader title="Developer" />
        <Section>
          <Row label="API URL" value={SERVER_URL} />
          <Row label="Check API" onPress={handleCheckApi} chevron />
          {canManageFeatures && <Row label="Features" onPress={() => navigation.navigate('FeaturesScreen')} chevron />}
        </Section>
      </DetailScrollView>
    </Page>
  );
}

const styles = StyleSheet.create({
  loginWrapper: { paddingTop: 8, marginBottom: 4 },
});
