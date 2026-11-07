import { type ReactNode, useCallback, useMemo, useRef } from 'react';
import { type ListRenderItemInfo, View, useWindowDimensions } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, { type SharedValue } from 'react-native-reanimated';

import type { SortableGridProps } from '@/components/sortable-grid/SortableGrid';
import useDragSelect from '@/components/sortable-grid/useDragSelect';
import useListRefCallback from '@/hooks/useListRefCallback';
import useScrollY from '@/hooks/useScrollY';
import useScrollingHeader from '@/hooks/useScrollingHeader';
import { layout as layoutTokens } from '@/styles/designTokens';
import type { AssetRow } from '@/sync/db/schema';

// Constant props, so FlatList's own memo isn't defeated on every render of the screen.
const keyExtractor = (asset: AssetRow) => asset.id;

// The props it shares with the sortable grid (SortableAssetGrid) as that types them; the selection
// by its asset names.
export type AssetListProps = Pick<
  SortableGridProps<AssetRow>,
  | 'listRef'
  | 'paddingTop'
  | 'paddingBottom'
  | 'header'
  | 'onScroll'
  | 'dragSelectEnabled'
  | 'dragSelectLocksSwipeBack'
  | 'onPeek'
  | 'onPeekEnd'
> & {
  rows: AssetRow[] | undefined;
  loadMore: () => void;
  renderListItem: (asset: AssetRow) => ReactNode;
  scrollY?: SharedValue<number>;
  selectedAssetIds?: string[];
  selectAssets?: (assetIds: string[]) => void;
};

// The virtualized asset grid: `rows` are the loaded assets of a paged query, `loadMore` reads the
// next page when the end comes near.
export default function AssetList({
  rows,
  loadMore,
  renderListItem,
  listRef,
  paddingTop = 0,
  paddingBottom = 0,
  header,
  onScroll,
  scrollY,
  dragSelectEnabled = false,
  dragSelectLocksSwipeBack,
  selectedAssetIds,
  selectAssets,
  onPeek,
  onPeekEnd,
}: AssetListProps) {
  const numColumns = 3;
  const window = useWindowDimensions();
  const listItemWidth = window.width / numColumns;
  const layout = useMemo(
    () => ({ numColumns, cellWidth: listItemWidth, cellHeight: listItemWidth, gap: 0 }),
    [listItemWidth],
  );

  // Track scroll offset internally when the screen doesn't already provide a
  // handler (e.g. album detail). When one is provided (library floating bars) we
  // reuse its shared value so drag-select reads an always-current offset.
  const internal = useScrollY();
  const effectiveScrollY = scrollY ?? internal.scrollY;
  const effectiveOnScroll = onScroll ?? internal.onScroll;

  const { headerView, cellsTop } = useScrollingHeader(header, paddingTop);

  const selectedIdsRef = useRef(selectedAssetIds);
  selectedIdsRef.current = selectedAssetIds;

  const attachList = useListRefCallback(listRef);

  const { gesture, onContainerLayout } = useDragSelect({
    enabled: dragSelectEnabled,
    rows,
    layout,
    paddingTop: cellsTop,
    listRef,
    scrollY: effectiveScrollY,
    selectedIdsRef,
    onSelect: selectAssets,
    locksSwipeBack: dragSelectLocksSwipeBack,
    onPeek,
    onPeekEnd,
  });

  const renderItem = useCallback(
    ({ item: asset }: ListRenderItemInfo<AssetRow>) => (
      <View style={{ width: listItemWidth, height: listItemWidth, padding: layoutTokens.gridGutter }}>
        {renderListItem(asset)}
      </View>
    ),
    [listItemWidth, renderListItem],
  );

  const contentContainerStyle = useMemo(() => ({ paddingTop, paddingBottom }), [paddingTop, paddingBottom]);

  if (!rows) return null;

  const list = (
    <Animated.FlatList
      keyboardDismissMode="on-drag"
      data={rows}
      numColumns={numColumns}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      contentContainerStyle={contentContainerStyle}
      ListHeaderComponent={headerView}
      // Grid rows, not cells: about a screen's worth. FlatList keeps these mounted at the top.
      initialNumToRender={10}
      onEndReached={loadMore}
      onEndReachedThreshold={2}
      ref={attachList}
      onScroll={effectiveOnScroll}
      scrollEventThrottle={16}
    />
  );

  // Only wrap in the drag-select gesture when the screen opted in by passing
  // selectAssets. Keeping the wrapper mounted regardless of select mode
  // avoids remounting the list (which would reset scroll position).
  if (!selectAssets) return list;

  return (
    <GestureDetector gesture={gesture}>
      <View style={{ flex: 1 }} onLayout={(e) => onContainerLayout(e.nativeEvent.layout.height)}>
        {list}
      </View>
    </GestureDetector>
  );
}
