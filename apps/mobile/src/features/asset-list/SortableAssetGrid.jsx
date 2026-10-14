import { useEffect, useMemo, useRef } from 'react';
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
const FREEZE_TIMEOUT_MS = 1000;

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
  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
    // Within two screens of the end: the next page (a no-op once everything is loaded).
    const { contentOffset, layoutMeasurement, contentSize } = event;
    if (contentOffset.y + layoutMeasurement.height * 3 >= contentSize.height) runOnJS(loadMore)();
  });

  // Reorder animation state (shared with the cells + the reorder gesture hook).
  const positions = useSharedValue({});
  const activeId = useSharedValue(null);
  const activeX = useSharedValue(0);
  const activeY = useSharedValue(0);
  const activeScale = useSharedValue(1);

  // The slots follow the rows, except from a drag's start until the first rows update after its
  // write landed: the write's promise resolves before the re-read is even queued, so the rows at that
  // moment are still the old order and would spring the cells back and forward again. A load-more or
  // a refresh during the drag can't spring them back either. If no update comes (a no-op write), a
  // timeout lifts the freeze and applies the latest rows.
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const isDraggingRef = useRef(false);
  const awaitingRowsRef = useRef(false);
  const freezeTimeoutRef = useRef(null);

  function applySlots() {
    const slots = {};
    (rowsRef.current ?? []).forEach((asset, index) => {
      slots[asset.id] = index;
    });
    positions.value = slots;
  }
  useEffect(() => {
    if (isDraggingRef.current) return;
    awaitingRowsRef.current = false;
    clearTimeout(freezeTimeoutRef.current);
    applySlots();
  }, [rows]);
  useEffect(() => () => clearTimeout(freezeTimeoutRef.current), []);

  function handleDragStart() {
    isDraggingRef.current = true;
  }
  async function handleDragEnd(change) {
    try {
      if (change) await onReorder(change);
    } finally {
      isDraggingRef.current = false;
      awaitingRowsRef.current = true;
      freezeTimeoutRef.current = setTimeout(() => {
        if (awaitingRowsRef.current) applySlots();
        awaitingRowsRef.current = false;
      }, FREEZE_TIMEOUT_MS);
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

  if (!rows) return null;

  const gridHeight = Math.ceil(rows.length / numColumns) * itemSize;

  function onLayout(e) {
    const { height } = e.nativeEvent.layout;
    dragSelect.onContainerLayout(height);
    dragReorder.onContainerLayout(height);
  }

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
            {rows.map((asset, index) => (
              <SortableAssetGridCell
                key={asset.id}
                asset={asset}
                renderCell={renderListItem}
                initialSlot={index}
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
