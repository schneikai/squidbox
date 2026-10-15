import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useCallback, useState, useTransition } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';

import DetailScrollView from '@/components/DetailScrollView';
import LoginForm from '@/components/LoginForm';
import Page from '@/components/Page';
import ScreenSectionHeader from '@/components/ScreenSectionHeader';
import FloatingDetailHeader from '@/components/floating-bars/FloatingDetailHeader';
import useProgressOverlay from '@/components/progress-overlay/useProgressOverlay';
import { Row, Section } from '@/components/settings-list/SettingsList';
import { MODEL_STORAGE_KEY, DEFAULT_MODEL } from '@/features/ai-suggestions/aiSuggestionsStorage';
import useCloud from '@/features/cloud/useCloud';
import useSignOutSheet from '@/features/cloud/useSignOutSheet';
import getBackupStatusText from '@/features/cloud-sync/getBackupStatusText';
import useCloudSync from '@/features/cloud-sync/useCloudSync';
import deviceLabel from '@/library/deviceLabel';
import libraryLabel from '@/library/libraryLabel';
import { readParkedCounts, removeLibrary } from '@/library/removeLibrary';
import unsyncedCountsText from '@/library/unsyncedCountsText';
import useLibrary from '@/library/useLibrary';
import useUnsyncedCounts from '@/library/useUnsyncedCounts';
import { colors } from '@/styles/designTokens';
import { useSyncStatus } from '@/sync/useSyncStatus';
import { SERVER_URL } from '@/utils/cloud-api/apiBaseUrl';
import useResortAlbumsByName from '@/utils/tools/useResortAlbumsByName';

// A parked library's row: what its snapshot says hadn't synced when it was closed.
function parkedValue({ closed }) {
  if (!closed) return null;
  return [`${closed.pendingCount} pending`, `${closed.atRiskCount} at risk`].join(' · ');
}

export default function SettingsScreen() {
  const navigation = useNavigation();
  const { isAuthenticated, needsReauth, user, logoutAsync } = useCloud();
  const { library, libraries } = useLibrary();
  const cloudSync = useCloudSync();
  const unsynced = useUnsyncedCounts(); // the one live query behind every count on this screen
  const { phase, lastError } = useSyncStatus();
  const confirmSignOutAsync = useSignOutSheet();

  const [aiModel, setAiModel] = useState(DEFAULT_MODEL);
  const [isLoggingOut, startLogoutTransition] = useTransition();

  const { showBlocking, hide } = useProgressOverlay();
  const resortAlbumsByNameAsync = useResortAlbumsByName();

  // Every library but this device's own while it is parked and empty (nothing added while signed out).
  const listedLibraries = libraries.filter(
    (entry) => entry.id === library.id || entry.owner.kind === 'account' || (entry.closed?.pendingCount ?? 0) > 0,
  );

  useFocusEffect(
    useCallback(() => {
      async function loadAiSettings() {
        try {
          const model = await AsyncStorage.getItem(MODEL_STORAGE_KEY);
          if (model) setAiModel(model);
        } catch {}
      }
      loadAiSettings();
    }, []),
  );

  // The choice is asked outside the transition: a state update made inside its callback before the
  // first await would be part of the pending transition and never render the sheet.
  async function handleLogout() {
    const choice = await confirmSignOutAsync(unsynced);
    if (choice) startLogoutTransition(() => logoutAsync(choice));
  }

  // A parked library is removed only after its own database was counted again (a crash can leave
  // the snapshot stale); it opens on a second connection, never through the open library.
  async function handleRemoveLibrary(parked) {
    const label = libraryLabel(parked);
    try {
      showBlocking();
      const text = unsyncedCountsText(await readParkedCounts(parked.id));
      hide();
      Alert.alert(
        `Remove ${label}?`,
        text ? `${text} haven't synced and will be lost.` : 'Everything in it is synced.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: async () => {
              try {
                showBlocking();
                await removeLibrary(parked.id);
              } catch (error) {
                Alert.alert("Couldn't remove", error.message);
              } finally {
                hide();
              }
            },
          },
        ],
      );
    } catch (error) {
      hide();
      Alert.alert("Couldn't open", error.message);
    }
  }

  function handleResortAlbums() {
    Alert.alert(
      'Sort albums by name?',
      'Reorders numbered albums from highest to lowest (e.g. 230, 220, 210). Albums without a numeric name stay where they are.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sort',
          onPress: async () => {
            try {
              showBlocking();
              const count = await resortAlbumsByNameAsync();
              Alert.alert('Done!', `Sorted ${count} album${count === 1 ? '' : 's'}.`);
            } catch (error) {
              Alert.alert('Failed', error.message);
            } finally {
              hide();
            }
          },
        },
      ],
    );
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
    const { pendingCount } = unsynced;
    if (needsReauth) return pendingCount > 0 ? `${pendingCount} waiting for sign-in` : 'Up to date';
    if (lastError) return 'Error';
    if (phase === 'pushing' || phase === 'pulling') return 'Syncing…';
    if (pendingCount > 0) return `${pendingCount} pending`;
    return 'Up to date';
  }

  function renderAccount() {
    if (isAuthenticated) {
      return (
        <Section>
          <Row label="Signed in as" value={user?.email} />
          <Row label="Sign out" onPress={isLoggingOut ? undefined : handleLogout} destructive chevron={!isLoggingOut}>
            {isLoggingOut && <ActivityIndicator size="small" color={colors.danger} />}
          </Row>
        </Section>
      );
    }
    const waiting = unsyncedCountsText(unsynced);
    return (
      <>
        {needsReauth && (
          <Section>
            <Row label="Sign in to sync" value={waiting ? `${waiting} waiting` : 'Everything synced'} />
          </Section>
        )}
        <View style={styles.loginWrapper}>
          <LoginForm ownerEmail={needsReauth ? user?.email : undefined} />
        </View>
      </>
    );
  }

  return (
    <Page>
      <FloatingDetailHeader title="Settings" onBack={() => navigation.goBack()} />
      <DetailScrollView>
        <ScreenSectionHeader title="Account" />
        {renderAccount()}

        {(isAuthenticated || needsReauth) && (
          <>
            <ScreenSectionHeader title="Backup & Sync" />
            <Section>
              <Row
                label="Photo backup"
                value={getBackupStatusText({ ...cloudSync, ...unsynced, needsReauth })}
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

        <ScreenSectionHeader title={`Libraries on ${deviceLabel()}`} />
        <Section>
          {listedLibraries.map((entry) =>
            entry.id === library.id ? (
              <Row
                key={entry.id}
                label={libraryLabel(entry)}
                value={[unsyncedCountsText(unsynced), 'Open'].filter(Boolean).join(' · ')}
              />
            ) : (
              <Row
                key={entry.id}
                label={libraryLabel(entry)}
                value={parkedValue(entry)}
                onPress={() => handleRemoveLibrary(entry)}
                chevron
              />
            ),
          )}
        </Section>

        <ScreenSectionHeader title="AI Caption Suggestions" />
        <Section>
          <Row label="Model" value={aiModel} />
          <Row label="Prompts" onPress={() => navigation.navigate('AiPromptsScreen')} chevron />
        </Section>

        <ScreenSectionHeader title="Data" />
        <Section>
          <Row label="Sort albums by name" onPress={handleResortAlbums} chevron />
        </Section>

        <ScreenSectionHeader title="Developer" />
        <Section>
          <Row label="API URL" value={SERVER_URL} />
          <Row label="Check API" onPress={handleCheckApi} chevron />
        </Section>
      </DetailScrollView>
    </Page>
  );
}

const styles = StyleSheet.create({
  loginWrapper: { paddingTop: 8, marginBottom: 4 },
});
