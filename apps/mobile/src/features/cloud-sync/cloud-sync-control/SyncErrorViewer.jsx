import { useEffect } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, { useSharedValue, useAnimatedScrollHandler } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ModalCloseButton from '@/components/ModalCloseButton';
import ModalHeader, { MODAL_HEADER_HEIGHT } from '@/components/ModalHeader';
import ModalSheet from '@/components/ModalSheet';
import { colors, radii, scale } from '@/styles/designTokens';
import { usePagedQuery } from '@/sync/usePagedQuery';

// The failures a paged `query` reads, as `{ id, title, error }` rows: what failed and why. `onRetryAll`
// retries every one of them, not just the loaded page. Closes itself once none are left.
export default function SyncErrorViewer({ query, onRetryAll, close }) {
  const { bottom } = useSafeAreaInsets();
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  const { rows, count, loadMore } = usePagedQuery(query, 50);

  useEffect(() => {
    if (count === 0) close();
  }, [count, close]);

  async function handleRetry() {
    await onRetryAll();
    close();
  }

  if (!rows || count === 0) return null;

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
          keyExtractor={(row) => String(row.id)}
          renderItem={({ item: row }) => (
            <View style={styles.errorRow}>
              <Text style={styles.errorTitle} numberOfLines={1}>
                {row.title}
              </Text>
              <Text style={styles.errorMessage}>{row.error}</Text>
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
  errorTitle: {
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
