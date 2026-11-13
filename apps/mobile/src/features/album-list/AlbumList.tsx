import type { ReactNode, RefObject } from 'react';
import type { ListRenderItemInfo, StyleProp, ViewStyle } from 'react-native';
import Animated, { type ScrollHandlerProcessed } from 'react-native-reanimated';

import useAlbumGrid from '@/features/album-list/useAlbumGrid';
import type { ScrollableList } from '@/hooks/useListControls';
import useListRefCallback from '@/hooks/useListRefCallback';
import type { AlbumListRow } from '@/sync/queries/albumQuery';

const keyExtractor = (album: AlbumListRow) => album.id;

export type AlbumListProps = {
  albums: AlbumListRow[];
  renderItem: (item: { album: AlbumListRow; elementWidth: number }) => ReactNode;
  listRef?: RefObject<ScrollableList | null>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  onScroll?: ScrollHandlerProcessed;
};

// The two-column album grid; `albums` are albumQuery rows (with their cover and stats). The column
// wrapper's margins give even insets left, right and between the items (see useAlbumGrid).
export default function AlbumList({ albums, renderItem, listRef, contentContainerStyle, onScroll }: AlbumListProps) {
  const { numColumns, gap, itemWidth } = useAlbumGrid();
  const attachList = useListRefCallback(listRef);

  return (
    <Animated.FlatList
      keyboardDismissMode="on-drag"
      ref={attachList}
      data={albums}
      numColumns={numColumns}
      columnWrapperStyle={{
        marginHorizontal: gap,
        marginTop: gap,
        justifyContent: 'space-between',
      }}
      renderItem={({ item: album }: ListRenderItemInfo<AlbumListRow>) => renderItem({ album, elementWidth: itemWidth })}
      keyExtractor={keyExtractor}
      contentContainerStyle={contentContainerStyle}
      onScroll={onScroll}
      scrollEventThrottle={16}
    />
  );
}
