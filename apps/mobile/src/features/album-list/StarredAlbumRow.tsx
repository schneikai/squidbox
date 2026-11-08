import { router } from 'expo-router';
import { FlatList, type ListRenderItemInfo, Pressable, StyleSheet, Text } from 'react-native';

import CoverImage from '@/components/CoverImage';
import type { AlbumListRow } from '@/features/album-list/albumQuery';
import { colors, layout, press, sizes, space, textStyles } from '@/styles/designTokens';

/**
 * The starred albums atop the Albums tab: each one's cover, small and square, with its name, side by
 * side, opening the album. Sized and spaced like the Contacts tab's pinned row (ContactAvatarRow).
 */
type StarredAlbumRowProps = { albums: AlbumListRow[] };

const keyExtractor = (album: AlbumListRow) => album.id;

export default function StarredAlbumRow({ albums }: StarredAlbumRowProps) {
  return (
    <FlatList
      horizontal
      data={albums}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      showsHorizontalScrollIndicator={false}
      style={styles.scroller}
      contentContainerStyle={styles.row}
    />
  );
}

function renderItem({ item: album }: ListRenderItemInfo<AlbumListRow>) {
  return (
    <Pressable
      style={({ pressed }) => [styles.item, pressed && press.flat]}
      onPress={() => router.navigate(`/album/${album.id}`)}
      accessibilityRole="button"
      accessibilityLabel={album.name}
    >
      <CoverImage asset={album.cover} style={styles.cover} />
      <Text style={[textStyles.footnote, styles.name]} numberOfLines={1}>
        {album.name}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Reaches the screen's edges, so it scrolls edge to edge, with the first cover on the grid's edge.
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
  cover: {
    width: sizes.avatar.medium,
    height: sizes.avatar.medium,
  },
  name: {
    color: colors.text.primary,
  },
});
