import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { useEffect, useState, useTransition } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import Ionicons from '@expo/vector-icons/Ionicons';

import Page from '@/components/Page';
import ScreenSectionHeader from '@/components/ScreenSectionHeader';
import FloatingDetailHeader from '@/components/floating-bars/FloatingDetailHeader';
import { SCREEN_PADDING } from '@/constants';

import LoginForm from '@/components/LoginForm';
import SyncErrorViewer from '@/features/cloud-sync/cloud-sync-control/SyncErrorViewer';
import { MODEL_STORAGE_KEY, DEFAULT_MODEL } from '@/features/ai-suggestions/aiSuggestionsStorage';
import useScreenPadding from '@/hooks/useScreenPadding';
import confirmLogoutAsync from '@/features/cloud/confirmLogoutAsync';
import useCloud from '@/features/cloud/useCloud';
import useCloudSync from '@/features/cloud-sync/useCloudSync';
import deleteLocalDataAsync from '@/utils/local-data/deleteLocalDataAsync';
import actionButtonStyles from '@/styles/actionButtonStyles';
import { colors, radii, spacing, typography } from '@/styles/designTokens';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL?.replace(/\/api\/v1\/?$/, '');

// ─── Reusable iOS-style building blocks ────────────────────────────────────

function Section({ children }) {
  const kids = Array.isArray(children) ? children.filter(Boolean) : [children].filter(Boolean);
  return (
    <View style={styles.section}>
      {kids.map((child, i) => (
        <View key={i}>
          {child}
          {i < kids.length - 1 && <View style={actionButtonStyles.listDivider} />}
        </View>
      ))}
    </View>
  );
}

function Row({ label, value, onPress, destructive, chevron, children }) {
  const content = (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, destructive && styles.rowLabelDestructive]}>{label}</Text>
      <View style={styles.rowRight}>
        {value ? <Text style={styles.rowValue}>{value}</Text> : null}
        {children}
        {chevron && <Ionicons name="chevron-forward" size={spacing.iconSizeSmall} color={colors.textTertiary} style={{ marginLeft: 4 }} />}
      </View>
    </View>
  );

  if (onPress) {
    return <TouchableOpacity onPress={onPress} activeOpacity={0.6}>{content}</TouchableOpacity>;
  }
  return content;
}

// ─── Main screen ────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const navigation = useNavigation();
  const { isAuthenticated, user, logoutAsync, loadDataAndSaveLocalAsync, backupDataAsync } = useCloud();
  const { unsyncedAssets, assetsWithSyncErrors, isSyncing, syncMessage, syncProgressMessage, syncSpeedMessage, syncNow } = useCloudSync();
  const [showSyncDetails, setShowSyncDetails] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);

  const [aiModel, setAiModel] = useState(DEFAULT_MODEL);
  const [isLoggingOut, startLogoutTransition] = useTransition();

  useEffect(() => {
    async function loadAiSettings() {
      try {
        const model = await AsyncStorage.getItem(MODEL_STORAGE_KEY);
        if (model) setAiModel(model);
      } catch {}
    }
    loadAiSettings();
  }, []);

  async function handleDeleteLocalData() {
    Alert.alert('Delete local data', 'This cannot be undone. Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteLocalDataAsync();
          Alert.alert('Done! Please restart the app.');
        },
      },
    ]);
  }

  async function handleLoadFromCloud() {
    Alert.alert('Load from cloud?', 'This will overwrite all local data.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Load',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteLocalDataAsync();
            await loadDataAndSaveLocalAsync();
            Alert.alert('Done! Reload the app to see changes.');
          } catch (error) {
            Alert.alert('Failed', error.message);
          }
        },
      },
    ]);
  }

  async function handleBackupToCloud() {
    Alert.alert('Backup to cloud?', '', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Backup',
        onPress: async () => {
          try {
            await backupDataAsync();
            Alert.alert('Done!');
          } catch (error) {
            Alert.alert('Failed', error.message);
          }
        },
      },
    ]);
  }

  function handleLogout() {
    startLogoutTransition(async () => {
      const confirmed = await confirmLogoutAsync();
      if (!confirmed) return;
      await logoutAsync();
    });
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

  const hasSyncDetails = isSyncing || assetsWithSyncErrors.length > 0;

  function handleSyncStatusPress() {
    if (assetsWithSyncErrors.length > 0) {
      setShowErrorModal(true);
    } else if (isSyncing) {
      setShowSyncDetails((v) => !v);
    }
  }

  function syncStatusText() {
    if (isSyncing) return syncMessage ?? 'Syncing…';
    if (assetsWithSyncErrors.length > 0) return `${assetsWithSyncErrors.length} error${assetsWithSyncErrors.length > 1 ? 's' : ''}`;
    if (unsyncedAssets.length > 0) return `${unsyncedAssets.length} unsynced`;
    return 'All synced';
  }

  const { paddingTop } = useScreenPadding('detail');

  return (
    <Page>
      <FloatingDetailHeader title="Settings" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop }]} automaticallyAdjustKeyboardInsets>
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

            <ScreenSectionHeader title="Cloud Sync" />
            <Section>
              <>
                <Row
                  label="Status"
                  value={syncStatusText()}
                  onPress={hasSyncDetails ? handleSyncStatusPress : undefined}
                  chevron={hasSyncDetails}
                />

                {showSyncDetails && isSyncing && (
                  <View style={styles.syncDetailPanel}>
                    {syncProgressMessage && (
                      <Text style={styles.syncDetailLine}>
                        {syncProgressMessage.sent} / {syncProgressMessage.total}{'  '}
                        <Text style={styles.syncDetailBold}>{syncProgressMessage.percent}</Text>
                      </Text>
                    )}
                    {syncSpeedMessage && (
                      <Text style={styles.syncDetailLine}>
                        {syncSpeedMessage.now}{'  '}
                        <Text style={styles.syncDetailMuted}>avg {syncSpeedMessage.avg}</Text>
                      </Text>
                    )}
                  </View>
                )}
              </>

              {showErrorModal && (
                <SyncErrorViewer
                  assetsWithSyncErrors={assetsWithSyncErrors}
                  close={() => setShowErrorModal(false)}
                />
              )}

              {unsyncedAssets.length > 0 && !isSyncing && (
                <Row label="Sync now" onPress={() => syncNow()} chevron />
              )}
              <Row label="Backup to cloud" onPress={handleBackupToCloud} chevron />
              <Row label="Load from cloud" onPress={handleLoadFromCloud} destructive chevron />
              <Row label="Delete local data" onPress={handleDeleteLocalData} destructive chevron />
            </Section>
          </>
        ) : (
          <View style={styles.loginWrapper}>
            <LoginForm />
          </View>
        )}

        {isAuthenticated && (
          <>
            <ScreenSectionHeader title="AI Caption Suggestions" />
            <Section>
              <Row label="Model" value={aiModel} />
              <Row label="Prompts" onPress={() => navigation.navigate('AiPromptsScreen')} chevron />
            </Section>

            <ScreenSectionHeader title="Developer" />
            <Section>
              <Row label="API URL" value={API_BASE_URL} />
              <Row label="Check API" onPress={handleCheckApi} chevron />
            </Section>
          </>
        )}

        <View style={styles.footer} />
      </ScrollView>
    </Page>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: SCREEN_PADDING,
  },

  section: {
    backgroundColor: colors.glassSurface,
    borderRadius: radii.card,
    marginBottom: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 20,
    elevation: 4,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: spacing.iconButtonSize,
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: 16,
  },
  rowLabel: {
    flex: 1,
    fontSize: typography.base,
    color: colors.text,
  },
  rowLabelDestructive: {
    color: colors.danger,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    marginLeft: 8,
  },
  rowValue: {
    fontSize: typography.base,
    color: colors.textSecondary,
    textAlign: 'right',
    flexShrink: 1,
  },

  syncDetailPanel: {
    backgroundColor: colors.glassSurface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.glassBorder,
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: 0,
    paddingBottom: 15,
    gap: 4,
  },
  syncDetailLine: {
    fontSize: typography.sm,
    color: colors.text,
    lineHeight: 18,
  },
  syncDetailBold: {
    fontWeight: '600',
    color: colors.text,
  },
  syncDetailMuted: {
    color: colors.textSecondary,
  },

  loginWrapper: {
    paddingTop: 8,
  },

  footer: {
    height: 40,
  },
});
