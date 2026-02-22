import { Modal, View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import useAssets from '@/features/assets-context/useAssets';

export default function SyncErrorViewer({ assetsWithSyncErrors, close }) {
  const insets = useSafeAreaInsets();
  const { updateAssets } = useAssets();

  async function handleRetry() {
    const assetIds = assetsWithSyncErrors.map((asset) => asset.id);
    await updateAssets(assetIds, { syncError: null });
    close();
  }

  return (
    <Modal animationType="slide" visible presentationStyle="pageSheet" onRequestClose={close}>
      <View style={[styles.container, { paddingBottom: insets.bottom }]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Sync Errors ({assetsWithSyncErrors.length})</Text>
          <TouchableOpacity onPress={close} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
        </View>

        {/* Error list */}
        <ScrollView contentContainerStyle={styles.list}>
          {assetsWithSyncErrors.map((asset) => (
            <View key={asset.id} style={styles.errorRow}>
              <Text style={styles.errorAssetId} numberOfLines={1}>{asset.id}</Text>
              <Text style={styles.errorMessage}>{asset.syncError}</Text>
            </View>
          ))}
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
            <Text style={styles.retryButtonText}>Retry All</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: 'white',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#C6C6C8',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  closeText: {
    fontSize: 16,
    color: '#007AFF',
  },

  list: {
    padding: 16,
    gap: 10,
  },
  errorRow: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 12,
  },
  errorAssetId: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 4,
  },
  errorMessage: {
    fontSize: 14,
    color: '#FF3B30',
    lineHeight: 20,
  },

  footer: {
    padding: 16,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
