import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedRef, useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';

import SortableAssetGridCell from './SortableAssetGridCell';
import applyPendingMoves from './applyPendingMoves';
import dropLandedMoves from './dropLandedMoves';
import useAssetDragReorder from './useAssetDragReorder';
import useAssetDragSelect from './useAssetDragSelect';

// Non-virtualized asset grid used by the album Assets tab. Unlike the virtualized AssetList
// (library / all-assets view), every cell is absolutely positioned so it can be dragged and
// reflowed for Apple Photos-style reordering. It renders every loaded row, so memory is what was
// scrolled to; `loadMore` reads the next page when the end comes near.
const NO_MOVES = [];

export default function SortableAssetGrid({
  rows,
  count,
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
  // Within two screens of the end: the next page, once per content height and count (not on every
  // scroll frame), so a no-op call is asked again once a page lands or the album grows.
  const loadMoreAt = useSharedValue({ height: -1, count: -1 });
  const scrollHandler = useAnimatedScrollHandler(
    (event) => {
      scrollY.value = event.contentOffset.y;
      const { contentOffset, layoutMeasurement, contentSize } = event;
      const isNearEnd = contentOffset.y + layoutMeasurement.height * 3 >= contentSize.height;
      const isAsked = loadMoreAt.value.height === contentSize.height && loadMoreAt.value.count === count;
      if (isNearEnd && !isAsked) {
        loadMoreAt.value = { height: contentSize.height, count };
        runOnJS(loadMore)();
      }
    },
    [loadMore, count],
  );

  // Reorder animation state (shared with the cells + the reorder gesture hook).
  const positions = useSharedValue({});
  const activeId = useSharedValue(null);
  const activeX = useSharedValue(0);
  const activeY = useSharedValue(0);
  const activeScale = useSharedValue(1);

  // The cells and the gestures follow the rows with the drops they don't show yet applied: a drop's
  // write is re-read after it, and the rows until then would spring the cells back and let the next
  // drag lift the wrong cell. While a drag runs, the gesture owns the slots; rows arriving meanwhile
  // apply after it.
  const [isDragging, setIsDragging] = useState(false);
  const [pendingMoves, setPendingMoves] = useState(NO_MOVES);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const ordered = useMemo(() => rows && applyPendingMoves(rows, pendingMoves), [rows, pendingMoves]);
  const slots = useMemo(() => Object.fromEntries((ordered ?? []).map((asset, slot) => [asset.id, slot])), [ordered]);
  useEffect(() => {
    if (!isDragging) positions.value = slots;
  }, [slots, isDragging]);

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
    rows: ordered,
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
    rows: ordered,
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

  const unlanded = dropLandedMoves(pendingMoves, rows);
  if (unlanded.length !== pendingMoves.length) setPendingMoves(unlanded);
  const gridHeight = Math.ceil((rows?.length ?? 0) / numColumns) * itemSize;

  function handleDragStart() {
    setIsDragging(true);
  }

  // The drop shows at once; its write lands later, or fails and the cells go back.
  async function handleDragEnd(change) {
    setIsDragging(false);
    if (!change) return;
    setPendingMoves((moves) => [...moves, change]);
    try {
      await onReorder(change);
      setPendingMoves((moves) =>
        moves.map((move) => (move === change ? { ...move, rowsWhenWritten: rowsRef.current } : move)),
      );
    } catch (error) {
      console.error('Reorder failed', error);
      setPendingMoves((moves) => moves.filter((move) => move !== change));
      Alert.alert("Couldn't move the photo", 'The drop was undone.');
    }
  }

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
