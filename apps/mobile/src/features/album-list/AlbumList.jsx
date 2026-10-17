import Animated from 'react-native-reanimated';

import useAlbumGrid from '@/features/album-list/useAlbumGrid';

const keyExtractor = (album) => album.id;

// The two-column album grid; `albums` are albumQuery rows (with their cover and stats). The column
// wrapper's margins give even insets left, right and between the items (see useAlbumGrid).
export default function AlbumList({
  albums,
  renderItem,
  ListHeaderComponent,
  listRef,
  contentContainerStyle,
  onScroll,
}) {
  const { numColumns, gap, itemWidth } = useAlbumGrid();

  return (
    <Animated.FlatList
      keyboardDismissMode="on-drag"
      ref={listRef}
      data={albums}
      numColumns={numColumns}
      columnWrapperStyle={{
        marginHorizontal: gap,
        marginTop: gap,
        justifyContent: 'space-between',
      }}
      renderItem={({ item: album }) => renderItem({ album, elementWidth: itemWidth })}
      keyExtractor={keyExtractor}
      ListHeaderComponent={ListHeaderComponent}
      stickyHeaderIndices={ListHeaderComponent ? [0] : undefined}
      contentContainerStyle={contentContainerStyle}
      onScroll={onScroll}
      scrollEventThrottle={16}
    />
  );
}
