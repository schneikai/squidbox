import { useEffect } from 'react';
import { Modal, View, Text, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ModalCloseButton from '@/components/ModalCloseButton';
import ModalHeader, { MODAL_HEADER_HEIGHT } from '@/components/ModalHeader';
import ModalSheet from '@/components/ModalSheet';
import PrimaryButton from '@/components/PrimaryButton';
import { Section } from '@/components/settings-list/SettingsList';
import { SCREEN_PADDING } from '@/constants';
import useScrollY from '@/hooks/useScrollY';
import { colors, typography } from '@/styles/designTokens';
import listTextStyles from '@/styles/listTextStyles';
import { usePagedQuery } from '@/sync/usePagedQuery';

// The failures a paged `query` reads, as `{ id, title, error }` rows: what failed and why. `onRetryAll`
// retries every one of them, not just the loaded page. Closes itself once none are left.
export default function SyncErrorViewer({ query, onRetryAll, close }) {
  const { bottom } = useSafeAreaInsets();
  const { scrollY, onScroll } = useScrollY();
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
            <Section>
              <View style={styles.errorRow}>
                <Text style={[listTextStyles.caption, styles.errorTitle]} numberOfLines={1}>
                  {row.title}
                </Text>
                <Text style={styles.errorMessage}>{row.error}</Text>
              </View>
            </Section>
          )}
          onEndReached={loadMore}
          onEndReachedThreshold={2}
          onScroll={onScroll}
          scrollEventThrottle={16}
          contentContainerStyle={[styles.list, { paddingTop: MODAL_HEADER_HEIGHT + SCREEN_PADDING }]}
        />

        <View style={styles.footer}>
          <PrimaryButton label="Retry All" onPress={handleRetry} />
        </View>
      </ModalSheet>
    </Modal>
  );
}

const styles = StyleSheet.create({
  list: {
    padding: SCREEN_PADDING,
    gap: 6,
  },
  errorRow: {
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: 12,
  },
  errorTitle: {
    marginBottom: 4,
  },
  errorMessage: {
    fontSize: typography.subheadline,
    color: colors.danger,
    lineHeight: 20,
  },

  footer: {
    padding: 16,
  },
});
