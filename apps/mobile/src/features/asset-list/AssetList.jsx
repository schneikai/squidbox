import { useCallback, useMemo, useRef } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';

import useDragSelect from '@/components/sortable-grid/useDragSelect';

// Constant props, so FlatList's own memo isn't defeated on every render of the screen.
const keyExtractor = (asset) => asset.id;
const STICKY_HEADER = [0];

// The virtualized asset grid: `rows` are the loaded assets of a paged query, `loadMore` reads the
// next page when the end comes near.
export default function AssetList({
  rows,
  loadMore,
  ListHeaderComponent,
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
}) {
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
  const internalScrollY = useSharedValue(0);
  const internalScrollHandler = useAnimatedScrollHandler((event) => {
    internalScrollY.value = event.contentOffset.y;
  });
  const effectiveScrollY = scrollY ?? internalScrollY;
  const effectiveOnScroll = onScroll ?? internalScrollHandler;

  const selectedIdsRef = useRef(selectedAssetIds);
  selectedIdsRef.current = selectedAssetIds;

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
  });

  const renderItem = useCallback(
    ({ item: asset }) => (
      <View style={{ width: listItemWidth, height: listItemWidth, padding: 1 }}>{renderListItem(asset)}</View>
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
      ListHeaderComponent={ListHeaderComponent}
      stickyHeaderIndices={ListHeaderComponent ? STICKY_HEADER : undefined}
      contentContainerStyle={contentContainerStyle}
      // Grid rows, not cells: about a screen's worth. FlatList keeps these mounted at the top.
      initialNumToRender={10}
      onEndReached={loadMore}
      onEndReachedThreshold={2}
      ref={listRef}
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
