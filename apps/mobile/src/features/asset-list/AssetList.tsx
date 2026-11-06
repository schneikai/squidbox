import { type ReactNode, type RefObject, useCallback, useMemo, useRef } from 'react';
import { type FlatList, type ListRenderItemInfo, View, useWindowDimensions } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, { type ScrollHandlerProcessed, type SharedValue } from 'react-native-reanimated';

import useDragSelect from '@/components/sortable-grid/useDragSelect';
import type { ScrollableList } from '@/hooks/useListControls';
import useScrollY from '@/hooks/useScrollY';
import { layout as layoutTokens } from '@/styles/designTokens';
import type { AssetRow } from '@/sync/db/schema';

// Constant props, so FlatList's own memo isn't defeated on every render of the screen.
const keyExtractor = (asset: AssetRow) => asset.id;

export type AssetListProps = {
  rows: AssetRow[] | undefined;
  loadMore: () => void;
  renderListItem: (asset: AssetRow) => ReactNode;
  listRef?: RefObject<ScrollableList | null>;
  paddingTop?: number;
  paddingBottom?: number;
  onScroll?: ScrollHandlerProcessed;
  scrollY?: SharedValue<number>;
  dragSelectEnabled?: boolean;
  dragSelectLocksSwipeBack?: boolean;
  selectedAssetIds?: string[];
  selectAssets?: (assetIds: string[]) => void;
  onPeek?: (asset: AssetRow) => void;
  onPeekEnd?: () => void;
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

  const selectedIdsRef = useRef(selectedAssetIds);
  selectedIdsRef.current = selectedAssetIds;

  // The list as `listRef`'s: a callback ref, since an object ref of ScrollableList isn't a FlatList's.
  const attachList = useCallback(
    (list: FlatList<AssetRow> | null) => {
      if (listRef) listRef.current = list;
    },
    [listRef],
  );

  const { gesture, onContainerLayout } = useDragSelect({
    enabled: dragSelectEnabled,
    rows,
    layout,
    paddingTop,
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
