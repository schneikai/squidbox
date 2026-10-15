import { useEffect, useMemo, useRef, useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedRef, useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';

import SortableAssetGridCell from './SortableAssetGridCell';
import useAssetDragReorder from './useAssetDragReorder';
import useAssetDragSelect from './useAssetDragSelect';

// Non-virtualized asset grid used by the album Assets tab. Unlike the virtualized AssetList
// (library / all-assets view), every cell is absolutely positioned so it can be dragged and
// reflowed for Apple Photos-style reordering. It renders every loaded row, so memory is what was
// scrolled to; `loadMore` reads the next page when the end comes near.
export default function SortableAssetGrid({
  rows,
  loadMore,
  renderListItem,
  paddingTop = 0,
  paddingBottom = 0,
  listRef,
  selectedAssetIds,
  selectAssets,
  dragSelectEnabled = false,
  reorderEnabled = false,
  onReorder,
}) {
  const numColumns = 3;
  const window = useWindowDimensions();
  const itemSize = window.width / numColumns;

  const scrollRef = useAnimatedRef();
  const scrollY = useSharedValue(0);
  // Within two screens of the end: the next page, once per content height (a no-op once everything
  // is loaded), not on every scroll frame.
  const loadMoreAtHeight = useSharedValue(-1);
  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
    const { contentOffset, layoutMeasurement, contentSize } = event;
    const isNearEnd = contentOffset.y + layoutMeasurement.height * 3 >= contentSize.height;
    if (isNearEnd && loadMoreAtHeight.value !== contentSize.height) {
      loadMoreAtHeight.value = contentSize.height;
      runOnJS(loadMore)();
    }
  });

  // Reorder animation state (shared with the cells + the reorder gesture hook).
  const positions = useSharedValue({});
  const activeId = useSharedValue(null);
  const activeX = useSharedValue(0);
  const activeY = useSharedValue(0);
  const activeScale = useSharedValue(1);

  // The slots follow the rows, with a dropped cell's move applied until the rows show it: the write's
  // re-read lands after the drop, and the rows until then would spring the cells back and forward
  // again. While a drag runs, the gesture owns the slots; rows arriving meanwhile apply after it.
  const [isDragging, setIsDragging] = useState(false);
  const [pendingMove, setPendingMove] = useState(null);
  if (pendingMove && isMoveSettled(rows, pendingMove)) setPendingMove(null);
  const slots = useMemo(() => getSlots(rows, pendingMove), [rows, pendingMove]);
  useEffect(() => {
    if (!isDragging) positions.value = slots;
  }, [slots, isDragging]);

  function handleDragStart() {
    setIsDragging(true);
  }
  async function handleDragEnd(change) {
    setIsDragging(false);
    if (!change) return;
    setPendingMove(change);
    try {
      await onReorder(change);
    } catch (error) {
      setPendingMove(null);
      throw error;
    }
  }

  // Expose a FlatList-compatible ref so useAssetList / the gesture hooks can call
  // scrollToOffset even though we render a ScrollView underneath.
  useEffect(() => {
    if (!listRef) return;
    listRef.current = {
      scrollToOffset: ({ offset, animated }) => scrollRef.current?.scrollTo({ y: offset, animated }),
    };
  });

  const selectedIdsRef = useRef(selectedAssetIds);
  selectedIdsRef.current = selectedAssetIds;

  const dragSelect = useAssetDragSelect({
    enabled: dragSelectEnabled,
    rows,
    numColumns,
    itemSize,
    paddingTop,
    listRef,
    scrollY,
    selectedIdsRef,
    selectAssets,
  });

  const dragReorder = useAssetDragReorder({
    enabled: reorderEnabled,
    rows,
    numColumns,
    itemSize,
    paddingTop,
    listRef,
    scrollY,
    positions,
    activeId,
    activeX,
    activeY,
    activeScale,
    onDragStart: handleDragStart,
    onDragEnd: handleDragEnd,
  });

  // Compose only what can run: on web, a disabled gesture inside Exclusive still makes the other
  // wait for it, so reordering would never start.
  const gesture = useMemo(
    () => (dragSelectEnabled ? Gesture.Exclusive(dragSelect.gesture, dragReorder.gesture) : dragReorder.gesture),
    [dragSelectEnabled, dragSelect.gesture, dragReorder.gesture],
  );
  const contentContainerStyle = useMemo(() => ({ paddingTop, paddingBottom }), [paddingTop, paddingBottom]);

  const gridHeight = Math.ceil((rows?.length ?? 0) / numColumns) * itemSize;

  function onLayout(e) {
    const { height } = e.nativeEvent.layout;
    dragSelect.onContainerLayout(height);
    dragReorder.onContainerLayout(height);
  }

  if (!rows) return null;

  return (
    <GestureDetector gesture={gesture}>
      <View style={{ flex: 1 }} onLayout={onLayout}>
        <Animated.ScrollView
          ref={scrollRef}
          keyboardDismissMode="on-drag"
          contentContainerStyle={contentContainerStyle}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
        >
          <View style={{ height: gridHeight }}>
            {rows.map((asset) => (
              <SortableAssetGridCell
                key={asset.id}
                asset={asset}
                renderCell={renderListItem}
                initialSlot={slots[asset.id]}
                itemSize={itemSize}
                numColumns={numColumns}
                positions={positions}
                activeId={activeId}
                activeX={activeX}
                activeY={activeY}
                activeScale={activeScale}
              />
            ))}
          </View>
        </Animated.ScrollView>
      </View>
    </GestureDetector>
  );
}

// Each loaded asset's slot: its row's index, with `move` ({ assetId, afterId }) applied.
function getSlots(rows, move) {
  const ids = (rows ?? []).map((asset) => asset.id);
  const from = move ? ids.indexOf(move.assetId) : -1;
  if (from !== -1) {
    ids.splice(from, 1);
    ids.splice(move.afterId === null ? 0 : ids.indexOf(move.afterId) + 1, 0, move.assetId);
  }
  return Object.fromEntries(ids.map((id, slot) => [id, slot]));
}

// Whether the rows already show `move`, or can't anymore (an asset of it left the grid).
function isMoveSettled(rows, { assetId, afterId }) {
  const index = rows.findIndex((asset) => asset.id === assetId);
  if (index === -1 || (afterId !== null && !rows.some((asset) => asset.id === afterId))) return true;
  return afterId === null ? index === 0 : rows[index - 1].id === afterId;
}
