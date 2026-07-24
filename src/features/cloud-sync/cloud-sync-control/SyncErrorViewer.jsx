import { Modal, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, { useSharedValue, useAnimatedScrollHandler } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ModalCloseButton from '@/components/ModalCloseButton';
import ModalHeader, { MODAL_HEADER_HEIGHT } from '@/components/ModalHeader';
import ModalSheet from '@/components/ModalSheet';
import useAssets from '@/features/assets-context/useAssets';
import { colors, radii, scale } from '@/styles/designTokens';

export default function SyncErrorViewer({ assetsWithSyncErrors, close }) {
  const { bottom } = useSafeAreaInsets();
  const { updateAssets } = useAssets();
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  async function handleRetry() {
    const assetIds = assetsWithSyncErrors.map((asset) => asset.id);
    await updateAssets(assetIds, { syncError: null });
    close();
  }

  return (
    <Modal animationType="slide" visible presentationStyle="pageSheet" onRequestClose={close}>
      <ModalSheet style={{ paddingBottom: bottom }}>
        <ModalHeader
          leftSlot={<ModalCloseButton onPress={close} />}
          centerSlot={`Sync Errors (${assetsWithSyncErrors.length})`}
          scrollY={scrollY}
        />

        <Animated.ScrollView
          onScroll={onScroll}
          scrollEventThrottle={16}
          contentContainerStyle={[styles.list, { paddingTop: MODAL_HEADER_HEIGHT }]}
        >
          {assetsWithSyncErrors.map((asset) => (
            <View key={asset.id} style={styles.errorRow}>
              <Text style={styles.errorAssetId} numberOfLines={1}>
                {asset.id}
              </Text>
              <Text style={styles.errorMessage}>{asset.syncError}</Text>
            </View>
          ))}
        </Animated.ScrollView>

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
