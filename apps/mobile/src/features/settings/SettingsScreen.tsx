import { router, useNavigation } from 'expo-router';
import { useTransition } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';

import DetailScrollView from '@/components/DetailScrollView';
import Page from '@/components/Page';
import ScreenSectionHeader from '@/components/ScreenSectionHeader';
import Switch from '@/components/Switch';
import FloatingDetailHeader from '@/components/floating-bars/FloatingDetailHeader';
import useProgressOverlay from '@/components/progress-overlay/useProgressOverlay';
import { Row, Section, SectionFooter } from '@/components/settings-list/SettingsList';
import getBackupStatusText from '@/features/cloud-sync/getBackupStatusText';
import useBackupCounts from '@/features/cloud-sync/useBackupCounts';
import useTagPhotosFromMentions from '@/features/contact-mentions/useTagPhotosFromMentions';
import DevAccountsSection from '@/features/dev-accounts/DevAccountsSection';
import LoginForm from '@/features/settings/LoginForm';
import confirmBackupSignOutAsync from '@/features/settings/confirmBackupSignOutAsync';
import getLibrarySyncStatusText from '@/features/sync-status/getLibrarySyncStatusText';
import useHasFeature from '@/hooks/useHasFeature';
import useIsAssistantAvailable from '@/hooks/useIsAssistantAvailable';
import useOpenLibrary from '@/library/useOpenLibrary';
import useAppSettings from '@/providers/app-settings/useAppSettings';
import useCloud from '@/providers/cloud/useCloud';
import useCloudSync from '@/providers/cloud-sync/useCloudSync';
import { colors, space } from '@/styles/designTokens';
import { useSyncStatus } from '@/sync/useSyncStatus';
import { SERVER_URL } from '@/utils/cloud-api/apiBaseUrl';
import apiErrorMessage from '@/utils/cloud-api/apiErrorMessage';
import confirmAsync from '@/utils/confirmAsync';
import useResortAlbumsByName from '@/utils/tools/useResortAlbumsByName';

export default function SettingsScreen() {
  const navigation = useNavigation();
  const { isAuthenticated, needsReauth, user, logoutAsync } = useCloud();
  const { library } = useOpenLibrary();
  const cloudSync = useCloudSync();
  const counts = useBackupCounts();
  const { phase, lastError, pendingCount, failedCount } = useSyncStatus();
  const { isVideoAutoplayOn, setIsVideoAutoplayOn, isHapticsOn, setIsHapticsOn } = useAppSettings();
  const isAssistantAvailable = useIsAssistantAvailable();
  const isDeveloper = useHasFeature('developer');

  const [isLoggingOut, startLogoutTransition] = useTransition();

  const { showBlocking, hide } = useProgressOverlay();
  const resortAlbumsByNameAsync = useResortAlbumsByName();
  const tagPhotosFromMentionsAsync = useTagPhotosFromMentions();

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
      Alert.alert('Failed', apiErrorMessage(error));
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
      Alert.alert('API unreachable', `${apiErrorMessage(error)}\n${SERVER_URL}`);
    }
  }

  function renderAccount() {
    if (isAuthenticated) {
      return (
        <Section>
          <Row label="Signed in as" value={user?.email} />
          <Row
            label="Sign out"
            onPress={isLoggingOut ? undefined : handleLogout}
            colorPalette="danger"
            hasChevron={!isLoggingOut}
          >
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
    <Page testID="settings-screen">
      <FloatingDetailHeader title="Settings" onBack={() => navigation.goBack()} />
      <DetailScrollView>
        <ScreenSectionHeader title="Account" />
        {renderAccount()}
        <DevAccountsSection />

        {isAccountLibrary && (
          <>
            <ScreenSectionHeader title="Backup & Sync" />
            {/* Backup = uploading full-res photo files to the cloud (manual). Library sync = the metadata
                engine (automatic). Each is one tappable status row → its own detail screen. */}
            <Section>
              <Row
                label="Photo backup"
                value={getBackupStatusText({ ...cloudSync, ...counts, needsReauth })}
                onPress={() => router.navigate('/settings/backup')}
                hasChevron
              />
              <Row
                label="Library sync"
                value={getLibrarySyncStatusText({ phase, lastError, pendingCount, failedCount, needsReauth })}
                onPress={() => router.navigate('/settings/sync')}
                hasChevron
              />
            </Section>
          </>
        )}

        {isAssistantAvailable && (
          <>
            <ScreenSectionHeader title="AI" />
            <Section>
              <Row label="Assistant" onPress={() => router.navigate('/settings/assistant')} hasChevron />
            </Section>
          </>
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
        <SectionFooter>Gentle taps when you move, peek at or save something.</SectionFooter>

        {isDeveloper && (
          <>
            <ScreenSectionHeader title="Developer" />
            <Section>
              <Row label="API URL" value={SERVER_URL} />
              <Row label="Check API" onPress={handleCheckApi} hasChevron />
              <Row label="Sort albums by name" onPress={handleResortAlbums} hasChevron />
              <Row label="Tag photos from mentions" onPress={tagPhotosFromMentionsAsync} hasChevron />
              <Row label="Features" onPress={() => router.navigate('/settings/features')} hasChevron />
              <Row label="Components" onPress={() => router.navigate('/settings/components')} hasChevron />
            </Section>
          </>
        )}
      </DetailScrollView>
    </Page>
  );
}

const styles = StyleSheet.create({
  loginWrapper: { paddingTop: space.sm, marginBottom: space.xs },
});
