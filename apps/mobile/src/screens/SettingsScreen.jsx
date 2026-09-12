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
import confirmLogoutAsync from '@/features/cloud/confirmLogoutAsync';
import useCloud from '@/features/cloud/useCloud';
import useCloudSync from '@/features/cloud-sync/useCloudSync';
import { colors } from '@/styles/designTokens';
import { useSyncStatus } from '@/sync/useSyncStatus';
import useResortAlbumsByName from '@/utils/tools/useResortAlbumsByName';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL?.replace(/\/api\/v1\/?$/, '');

export default function SettingsScreen() {
  const navigation = useNavigation();
  const { isAuthenticated, user, logoutAsync } = useCloud();
  const { unsyncedAssets, assetsWithSyncErrors, isSyncing, syncMessage } = useCloudSync();
  const { phase, pendingCount, lastError } = useSyncStatus();

  const [aiModel, setAiModel] = useState(DEFAULT_MODEL);
  const [isLoggingOut, startLogoutTransition] = useTransition();

  const { showBlocking, hide } = useProgressOverlay();
  const resortAlbumsByNameAsync = useResortAlbumsByName();

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

  function handleLogout() {
    startLogoutTransition(async () => {
      const confirmed = await confirmLogoutAsync();
      if (!confirmed) return;
      await logoutAsync();
    });
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
      const response = await fetch(`${API_BASE_URL}/up`);
      if (response.ok) {
        Alert.alert('API reachable', API_BASE_URL);
      } else {
        Alert.alert('API error', `Status: ${response.status}\n${API_BASE_URL}`);
      }
    } catch (error) {
      Alert.alert('API unreachable', `${error.message}\n${API_BASE_URL}`);
    }
  }

  // Backup = uploading full-res photo files to the cloud (manual). Library sync = the metadata
  // engine (automatic). Each is one tappable status row → its own detail screen.
  function backupStatusText() {
    if (isSyncing) return syncMessage ?? 'Backing up…';
    if (assetsWithSyncErrors.length > 0)
      return `${assetsWithSyncErrors.length} error${assetsWithSyncErrors.length > 1 ? 's' : ''}`;
    if (unsyncedAssets.length > 0) return `${unsyncedAssets.length} not backed up`;
    return 'All backed up';
  }

  function librarySyncStatusText() {
    if (lastError) return 'Error';
    if (phase === 'pushing' || phase === 'pulling') return 'Syncing…';
    if (pendingCount > 0) return `${pendingCount} pending`;
    return 'Up to date';
  }

  return (
    <Page>
      <FloatingDetailHeader title="Settings" onBack={() => navigation.goBack()} />
      <DetailScrollView>
        {isAuthenticated ? (
          <>
            <ScreenSectionHeader title="Account" />
            <Section>
              <Row label="Signed in as" value={user?.email} />
              <Row
                label="Sign out"
                onPress={isLoggingOut ? undefined : handleLogout}
                destructive
                chevron={!isLoggingOut}
              >
                {isLoggingOut && <ActivityIndicator size="small" color={colors.danger} />}
              </Row>
            </Section>

            <ScreenSectionHeader title="Backup & Sync" />
            <Section>
              <Row
                label="Photo backup"
                value={backupStatusText()}
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
              <Row label="API URL" value={API_BASE_URL} />
              <Row label="Check API" onPress={handleCheckApi} chevron />
            </Section>
          </>
        ) : (
          <View style={styles.loginWrapper}>
            <LoginForm />
          </View>
        )}
      </DetailScrollView>
    </Page>
  );
}

const styles = StyleSheet.create({
  loginWrapper: { paddingTop: 8 },
});
