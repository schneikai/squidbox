import { Modal, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, { useSharedValue, useAnimatedScrollHandler } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ModalCloseButton from '@/components/ModalCloseButton';
import ModalHeader, { MODAL_HEADER_HEIGHT } from '@/components/ModalHeader';
import ModalSheet from '@/components/ModalSheet';
import useRunWithProgress from '@/components/progress-overlay/useRunWithProgress';
import useAssets from '@/features/assets-context/useAssets';
import { colors, radii, scale } from '@/styles/designTokens';
import { readSyncErrors } from '@/sync/assetsRepository';
import { getDb, schema } from '@/sync/db/client';
import { usePagedQuery } from '@/sync/usePagedQuery';

const errorsQuery = { read: readSyncErrors, tables: [schema.assets] };

export default function SyncErrorViewer({ close }) {
  const { bottom } = useSafeAreaInsets();
  const { setAssetsSyncError } = useAssets();
  const runWithProgress = useRunWithProgress();
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  const { rows, count, loadMore } = usePagedQuery(errorsQuery, [], 50);

  // Clears every error, not just the loaded page, so each failed upload is retried.
  async function handleRetry() {
    const { rows: failed } = await readSyncErrors(getDb(), { limit: count });
    const assetIds = failed.map((asset) => asset.id);
    await runWithProgress((batchOptions) => setAssetsSyncError(assetIds, null, batchOptions));
    close();
  }

  if (!rows) return null;

  return (
    <Modal animationType="slide" visible presentationStyle="pageSheet" onRequestClose={close}>
      <ModalSheet style={{ paddingBottom: bottom }}>
        <ModalHeader
          leftSlot={<ModalCloseButton onPress={close} />}
          centerSlot={`Sync Errors (${count})`}
          scrollY={scrollY}
        />

        <Animated.FlatList
          data={rows}
          keyExtractor={(asset) => asset.id}
          renderItem={({ item: asset }) => (
            <View style={styles.errorRow}>
              <Text style={styles.errorAssetId} numberOfLines={1}>
                {asset.id}
              </Text>
              <Text style={styles.errorMessage}>{asset.syncError}</Text>
            </View>
          )}
          onEndReached={loadMore}
          onEndReachedThreshold={2}
          onScroll={onScroll}
          scrollEventThrottle={16}
          contentContainerStyle={[styles.list, { paddingTop: MODAL_HEADER_HEIGHT }]}
        />

        <View style={styles.footer}>
          <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
            <Text style={styles.retryButtonText}>Retry All</Text>
          </TouchableOpacity>
        </View>
      </ModalSheet>
    </Modal>
  );
}

const styles = StyleSheet.create({
  list: {
    padding: 16,
    gap: 10,
  },
  errorRow: {
    backgroundColor: colors.glassSurface,
    borderRadius: radii.card,
    padding: 12,
  },
  errorAssetId: {
    fontSize: scale(12),
    color: colors.textSecondary,
    marginBottom: 4,
  },
  errorMessage: {
    fontSize: scale(14),
    color: colors.danger,
    lineHeight: 20,
  },

  footer: {
    padding: 16,
  },
  retryButton: {
    backgroundColor: colors.accent,
    borderRadius: radii.card,
    paddingVertical: 14,
    alignItems: 'center',
  },
  retryButtonText: {
    color: colors.textInverse,
    fontSize: scale(16),
    fontWeight: '600',
  },
});
