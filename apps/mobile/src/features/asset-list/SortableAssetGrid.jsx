import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedRef, useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';

import SortableAssetGridCell from './SortableAssetGridCell';
import applyPendingMoves from './applyPendingMoves';
import dropLandedMoves from './dropLandedMoves';
import useAssetDragReorder from './useAssetDragReorder';
import useAssetDragSelect from './useAssetDragSelect';

import { getDb } from '@/sync/db/client';

// Non-virtualized asset grid used by the album Assets tab. Unlike the virtualized AssetList
// (library / all-assets view), every cell is absolutely positioned so it can be dragged and
// reflowed for Apple Photos-style reordering. It renders every loaded row, so memory is what was
// scrolled to; `loadMore` reads the next page when the end comes near.
const NO_MOVES = [];

export default function SortableAssetGrid({
  rows,
  rowsReadAt,
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
  // Within two screens of the end: ask for the next page on arriving there and again whenever the
  // content grows while still there, not on every scroll frame. usePagedQuery keeps an ask until more
  // rows can show, so none is lost.
  const askedAtHeight = useSharedValue(-1);
  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
    const { contentOffset, layoutMeasurement, contentSize } = event;
    if (contentOffset.y + layoutMeasurement.height * 3 < contentSize.height) {
      askedAtHeight.value = -1;
    } else if (askedAtHeight.value !== contentSize.height) {
      askedAtHeight.value = contentSize.height;
      runOnJS(loadMore)();
    }
  });

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
  const [pendingMoves, setPendingMoves] = useState(NO_MOVES);
  // One reorder at a time: a drag waits until the previous drop's write has settled, so each drop is
  // made on an order the database has (a failed first drop would leave the second on a guessed one).
  const [isWriting, setIsWriting] = useState(false);
  const isDraggingRef = useRef(false);
  const sentOrderRef = useRef(null);
  const landed = dropLandedMoves(pendingMoves, rowsReadAt);
  const moves = landed.length === pendingMoves.length ? pendingMoves : landed;
  if (moves !== pendingMoves) setPendingMoves(moves);
  const ordered = rows && applyPendingMoves(rows, moves);
  const initialSlots = useMemo(() => new Map(ordered?.map((asset, slot) => [asset.id, slot])), [ordered]);
  const orderedRef = useRef(ordered);
  orderedRef.current = ordered;
  useEffect(() => {
    if (ordered && !isDraggingRef.current) sendSlots(ordered);
  }, [ordered]);

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
    enabled: reorderEnabled && !isWriting,
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

  const gridHeight = Math.ceil((rows?.length ?? 0) / numColumns) * itemSize;

  // The slots go to the UI thread only when the order changed, not for every new rows array.
  function sendSlots(list) {
    const ids = list.map((asset) => asset.id);
    const sent = sentOrderRef.current;
    if (sent && sent.length === ids.length && sent.every((id, slot) => id === ids[slot])) return;
    sentOrderRef.current = ids;
    positions.value = Object.fromEntries(ids.map((id, slot) => [id, slot]));
  }

  function handleDragStart() {
    isDraggingRef.current = true;
  }

  // The drop shows at once; its write lands later, or fails and the cells go back.
  async function handleDragEnd(change) {
    isDraggingRef.current = false;
    // The gesture moved the slots itself: whatever arrived during the drag applies now.
    sentOrderRef.current = null;
    sendSlots(applyPendingMoves(orderedRef.current, change ? [change] : NO_MOVES));
    if (!change) return;
    setPendingMoves((current) => [...current, change]);
    setIsWriting(true);
    try {
      await onReorder(change);
      const writtenAt = getDb().committedWrites();
      setPendingMoves((current) => current.map((move) => (move === change ? { ...move, writtenAt } : move)));
    } catch (error) {
      console.error('Reorder failed', error);
      setPendingMoves((current) => current.filter((move) => move !== change));
      Alert.alert("Couldn't move the photo", 'The drop was undone.');
    } finally {
      setIsWriting(false);
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
                initialSlot={initialSlots.get(asset.id)}
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
