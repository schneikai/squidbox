import { router } from 'expo-router';
import { useEffect } from 'react';
import { FlatList, Modal, Pressable, View, Text as RNText, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Button from '@/components/Button';
import ModalHeader from '@/components/ModalHeader';
import ModalSheet from '@/components/ModalSheet';
import Text from '@/components/Text';
import { Section } from '@/components/settings-list/SettingsList';
import { SCREEN_PADDING } from '@/constants';
import { layout, press, space } from '@/styles/designTokens';
import listTextStyles from '@/styles/listTextStyles';
import { usePagedQuery } from '@/sync/usePagedQuery';

// The failures a paged `query` reads, as `{ id, title, error, href? }` rows: what failed and why; a row
// with an `href` opens it (where the way out is). `onRetryAll` retries every one of them, not just the
// loaded page. Closes itself once none are left.
export default function SyncErrorViewer({ query, onRetryAll, close }) {
  const { bottom } = useSafeAreaInsets();
  const { rows, count, loadMore } = usePagedQuery(query, 50);

  useEffect(() => {
    if (count === 0) close();
  }, [count, close]);

  function handleOpen(href) {
    close();
    router.navigate(href);
  }

  async function handleRetry() {
    await onRetryAll();
    close();
  }

  if (!rows || count === 0) return null;

  return (
    <Modal animationType="slide" visible presentationStyle="pageSheet" onRequestClose={close}>
      <ModalSheet style={{ paddingBottom: bottom }}>
        <ModalHeader
          leading={<Button icon="close" accessibilityLabel="Close" onPress={close} />}
          title={`Sync Errors (${count})`}
        />

        <FlatList
          data={rows}
          keyExtractor={(row) => String(row.id)}
          renderItem={({ item: row }) => (
            <Section>
              <Pressable
                style={({ pressed }) => [styles.errorRow, pressed && press.flat]}
                disabled={!row.href}
                onPress={() => handleOpen(row.href)}
                accessibilityRole={row.href ? 'link' : undefined}
              >
                <RNText style={[listTextStyles.caption, styles.errorTitle]} numberOfLines={1}>
                  {row.title}
                </RNText>
                <Text variant="error">{row.error}</Text>
              </Pressable>
            </Section>
          )}
          onEndReached={loadMore}
          onEndReachedThreshold={2}
          contentContainerStyle={styles.list}
        />

        <View style={styles.footer}>
          <Button variant="primary" label="Retry All" onPress={handleRetry} />
        </View>
      </ModalSheet>
    </Modal>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingTop: layout.sheetContentTop,
    paddingHorizontal: SCREEN_PADDING,
    paddingBottom: SCREEN_PADDING,
    gap: space.sm,
  },
  errorRow: {
    paddingHorizontal: layout.rowInset,
    paddingVertical: layout.rowPaddingYCompact,
  },
  errorTitle: {
    marginBottom: space.xs,
  },

  footer: {
    padding: layout.cardInset,
  },
});
