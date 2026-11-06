import { useCallback, useState } from 'react';
import { type LayoutChangeEvent, View } from 'react-native';

import type { AlbumListProps } from './AlbumList';

import SortableGrid, { type SortableGridProps } from '@/components/sortable-grid/SortableGrid';
import type { AlbumListRow } from '@/features/album-list/albumQuery';
import useAlbumGrid from '@/features/album-list/useAlbumGrid';

// Below the cover: the name and the count lines, until an item has been measured.
const ESTIMATED_INFO_HEIGHT = 36;

type SortableAlbumListProps = Pick<
  SortableGridProps<AlbumListRow>,
  'rowsReadAt' | 'listRef' | 'paddingTop' | 'paddingBottom' | 'onScroll' | 'reorderEnabled' | 'onReorder'
> &
  Pick<AlbumListProps, 'albums' | 'renderItem'>;

// AlbumList's grid as a SortableGrid, so albums can be dragged into a new order. `albums` are
// albumQuery rows; `onScroll` (optional) gets the list's scroll events too.
export default function SortableAlbumList({
  albums,
  rowsReadAt,
  renderItem,
  listRef,
  paddingTop,
  paddingBottom,
  onScroll,
  reorderEnabled,
  onReorder,
}: SortableAlbumListProps) {
  const { numColumns, gap, itemWidth } = useAlbumGrid();
  // An item is as tall as its text makes it (Dynamic Type), the same for every album shown: each one
  // reports its height, and only a different height renders.
  const [itemHeight, setItemHeight] = useState<number | null>(null);
  const measureItem = useCallback((e: LayoutChangeEvent) => setItemHeight(e.nativeEvent.layout.height), []);
  const renderCell = useCallback(
    (album: AlbumListRow) => <View onLayout={measureItem}>{renderItem({ album, elementWidth: itemWidth })}</View>,
    [measureItem, renderItem, itemWidth],
  );

  return (
    <SortableGrid
      rows={albums}
      rowsReadAt={rowsReadAt}
      renderItem={renderCell}
      numColumns={numColumns}
      gap={gap}
      cellHeight={itemHeight ?? itemWidth + ESTIMATED_INFO_HEIGHT}
      paddingTop={paddingTop}
      paddingBottom={paddingBottom}
      listRef={listRef}
      onScroll={onScroll}
      reorderEnabled={reorderEnabled}
      onReorder={onReorder}
      moveFailedTitle="Couldn't move the album"
    />
  );
}
