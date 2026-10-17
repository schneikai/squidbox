import { useCallback, useState } from 'react';
import { View } from 'react-native';

import SortableGrid from '@/components/sortable-grid/SortableGrid';
import useAlbumGrid from '@/features/album-list/useAlbumGrid';

// Below the cover: the name and the count lines, until an item has been measured.
const ESTIMATED_INFO_HEIGHT = 36;

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
}) {
  const { numColumns, gap, itemWidth } = useAlbumGrid();
  // An item is as tall as its text makes it (Dynamic Type), the same for every album shown: each one
  // reports its height, and only a different height renders.
  const [itemHeight, setItemHeight] = useState(null);
  const measureItem = useCallback((e) => setItemHeight(e.nativeEvent.layout.height), []);
  const renderCell = useCallback(
    (album) => <View onLayout={measureItem}>{renderItem({ album, elementWidth: itemWidth })}</View>,
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
