import type { ReactNode } from 'react';
import { FlatList, Pressable, StyleSheet } from 'react-native';

import Text from '@/components/Text';
import { layout, press, sizes, space } from '@/styles/designTokens';

type PictureRowProps<T> = {
  items: T[];
  keyOf: (item: T) => string;
  // A medium avatar-sized picture: a contact's avatar, an album's cover.
  picture: (item: T) => ReactNode;
  label: (item: T) => string;
  // What a screen reader says for the item; its label when left out.
  accessibilityLabel?: (item: T) => string;
  onPress: (item: T) => void;
  // Reads the next page as the row nears its end, for a paged query's loaded items.
  onEndReached?: () => void;
  testID?: string;
};

/**
 * A row of small pictures with a label under each, side by side, atop a tab (Contacts' pinned list,
 * Albums' Starred). It reaches the screen's edges, so it scrolls edge to edge, with the first
 * picture on the gutter, the edge of the list below it.
 */
export default function PictureRow<T>({
  items,
  keyOf,
  picture,
  label,
  accessibilityLabel = label,
  onPress,
  onEndReached,
  testID,
}: PictureRowProps<T>) {
  return (
    <FlatList
      testID={testID}
      horizontal
      data={items}
      keyExtractor={keyOf}
      renderItem={({ item }) => (
        <Pressable
          style={({ pressed }) => [styles.item, pressed && press.flat]}
          onPress={() => onPress(item)}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel(item)}
        >
          {picture(item)}
          <Text variant="hint" tone="primary" numberOfLines={1}>
            {label(item)}
          </Text>
        </Pressable>
      )}
      onEndReached={onEndReached}
      onEndReachedThreshold={2}
      showsHorizontalScrollIndicator={false}
      style={styles.scroller}
      contentContainerStyle={styles.row}
    />
  );
}

const styles = StyleSheet.create({
  scroller: {
    marginHorizontal: -layout.sideGutter,
  },
  row: {
    gap: space.xl,
    paddingHorizontal: layout.sideGutter,
  },
  item: {
    width: sizes.avatar.medium,
    alignItems: 'center',
    gap: space.sm,
  },
});
