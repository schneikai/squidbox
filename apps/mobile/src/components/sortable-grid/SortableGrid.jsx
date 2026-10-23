import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useComposedEventHandler,
  useSharedValue,
} from 'react-native-reanimated';

import SortableGridCell from './SortableGridCell';
import SortableGridLiftedCell from './SortableGridLiftedCell';
import heldOrder from './heldOrder';
import useDragReorder from './useDragReorder';
import useDragSelect from './useDragSelect';

import useHaptics from '@/hooks/useHaptics';

// A grid whose cells can be dragged into a new order, Apple Photos-style (an album's photos, the
// albums). Cells are absolutely positioned so they can be dragged and reflowed, and only the rows
// within WINDOW_SCREENS screens of the viewport are mounted, like a FlatList's window. With `onPeek`,
// a lifted cell held still peeks instead (see useDragReorder).
const WINDOW_SCREENS = 2;
// How long after a drop its click may still come (it follows the pointer's release at once).
const CLICK_AFTER_DROP_MS = 500;

export default function SortableGrid({
  rows,
  rowsReadAt,
  loadMore,
  renderItem,
  numColumns,
  gap = 0,
  cellHeight,
  cellPadding = 0,
  paddingTop = 0,
  paddingBottom = 0,
  listRef,
  onScroll,
  dragSelectEnabled = false,
  dragSelectLocksSwipeBack,
  selectedIds,
  onSelect,
  reorderEnabled = false,
  onReorder,
  moveFailedTitle,
  onPeek,
  onPeekEnd,
}) {
  const window = useWindowDimensions();
  const haptics = useHaptics();
  const cellWidth = (window.width - gap * (numColumns + 1)) / numColumns;
  const layout = useMemo(
    () => ({ numColumns, cellWidth, cellHeight: cellHeight ?? cellWidth, gap }),
    [numColumns, cellWidth, cellHeight, gap],
  );

  // The grid's own offset: a screen's shared one (the floating bars') is reset on tab switches.
  const scrollRef = useAnimatedRef();
  const scrollY = useSharedValue(0);
  // Within two screens of the end: ask for the next page on arriving there and again whenever the
  // content grows while still there, not on every scroll frame. usePagedQuery keeps an ask until more
  // rows can show, so none is lost.
  const askedAtHeight = useSharedValue(-1);
  const loadMoreRef = useRef(loadMore);
  loadMoreRef.current = loadMore;
  const askForMore = useCallback(() => loadMoreRef.current?.(), []);
  const trackScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
    const { contentOffset, layoutMeasurement, contentSize } = event;
    if (contentOffset.y + layoutMeasurement.height * 3 < contentSize.height) {
      askedAtHeight.value = -1;
    } else if (askedAtHeight.value !== contentSize.height) {
      askedAtHeight.value = contentSize.height;
      runOnJS(askForMore)();
    }
  });
  const handleScroll = useComposedEventHandler([trackScroll, onScroll ?? null]);

  // The mounted window moves a screen at a time: the screen the viewport's top is in.
  const [viewportHeight, setViewportHeight] = useState(window.height);
  const [screenIndex, setScreenIndex] = useState(0);
  useAnimatedReaction(
    () => Math.floor(scrollY.value / viewportHeight),
    (index, prev) => {
      if (index !== prev) runOnJS(setScreenIndex)(index);
    },
  );

  // Reorder animation state (shared with the cells + the reorder gesture hook).
  const positions = useSharedValue({});
  const activeId = useSharedValue(null);
  const activeX = useSharedValue(0);
  const activeY = useSharedValue(0);
  const activeScale = useSharedValue(1);
  const shownLiftedId = useSharedValue(null);
  const [liftedId, setLiftedId] = useState(null);

  const containerRef = useRef(null);
  const swallowClickUntilRef = useRef(0);

  // After a drop the cells and the gestures hold the order it left until rows that include its write
  // land (heldOrder): the rows until then would spring the cells back and let the next drag lift the
  // wrong cell. While a drag runs, the gesture owns the slots; rows arriving meanwhile apply after it.
  const [hold, setHold] = useState(null);
  // One reorder at a time: a drag waits until the previous drop's write has settled, so each drop is
  // made on an order the database has (a failed first drop would leave the second on a guessed one).
  const [isWriting, setIsWriting] = useState(false);
  const isDraggingRef = useRef(false);
  const sentOrderRef = useRef(null);
  const ordered = useMemo(() => {
    const heldIds = rows && heldOrder(hold, rows, rowsReadAt, reorderEnabled);
    if (!heldIds) return rows;
    const byId = new Map(rows.map((row) => [row.id, row]));
    return heldIds.map((id) => byId.get(id));
  }, [rows, rowsReadAt, hold, reorderEnabled]);
  const orderedRef = useRef(ordered);
  orderedRef.current = ordered;
  useEffect(() => {
    if (ordered && !isDraggingRef.current) sendSlots(ordered.map((row) => row.id));
  }, [ordered]);

  // On web a press ends in a DOM click, which the pan doesn't cancel as it does natively: the click
  // that follows a lift (moved or not) is swallowed in the capture phase, before the cell's pressable.
  const isShown = Boolean(ordered);
  useEffect(() => {
    const node = containerRef.current;
    if (Platform.OS !== 'web' || !node?.addEventListener) return undefined;
    function swallowClick(event) {
      if (Date.now() > swallowClickUntilRef.current) return;
      swallowClickUntilRef.current = 0;
      event.stopPropagation();
      event.preventDefault();
    }
    node.addEventListener('click', swallowClick, true);
    return () => node.removeEventListener('click', swallowClick, true);
  }, [isShown]);

  // A FlatList-compatible ref, so the screens and the gesture hooks can call scrollToOffset.
  useEffect(() => {
    if (!listRef) return;
    listRef.current = {
      scrollToOffset: ({ offset, animated }) => scrollRef.current?.scrollTo({ y: offset, animated }),
    };
  });

  const selectedIdsRef = useRef(selectedIds);
  selectedIdsRef.current = selectedIds;
  const dragSelect = useDragSelect({
    enabled: dragSelectEnabled,
    rows: ordered,
    layout,
    paddingTop,
    listRef,
    scrollY,
    selectedIdsRef,
    onSelect,
    locksSwipeBack: dragSelectLocksSwipeBack,
  });

  const dragReorder = useDragReorder({
    enabled: reorderEnabled && !isWriting,
    rows: ordered,
    layout,
    paddingTop,
    listRef,
    scrollY,
    positions,
    activeId,
    activeX,
    activeY,
    activeScale,
    shownLiftedId,
    onDragStart: handleDragStart,
    onDragEnd: handleDragEnd,
    onSettled: handleSettled,
    onPeek,
    onPeekEnd,
  });

  // Compose only what can run: on web, a disabled gesture inside Exclusive still makes the other
  // wait for it, so reordering would never start.
  const gesture = useMemo(
    () => (dragSelectEnabled ? Gesture.Exclusive(dragSelect.gesture, dragReorder.gesture) : dragReorder.gesture),
    [dragSelectEnabled, dragSelect.gesture, dragReorder.gesture],
  );
  const contentContainerStyle = useMemo(() => ({ paddingTop, paddingBottom }), [paddingTop, paddingBottom]);

  const rowPitch = layout.cellHeight + layout.gap;
  const gridHeight = Math.ceil((rows?.length ?? 0) / numColumns) * rowPitch;
  const windowTop = (screenIndex - WINDOW_SCREENS) * viewportHeight - paddingTop;
  const windowBottom = (screenIndex + 1 + WINDOW_SCREENS) * viewportHeight - paddingTop;
  const firstSlot = Math.max(0, Math.floor(windowTop / rowPitch)) * numColumns;
  const endSlot = Math.max(0, Math.ceil(windowBottom / rowPitch)) * numColumns;
  const lifted = useMemo(() => liftedId && ordered?.find((row) => row.id === liftedId), [liftedId, ordered]);

  // The slots go to the UI thread only when the order changed, not for every new rows array.
  function sendSlots(ids) {
    const sent = sentOrderRef.current;
    if (sent && sent.length === ids.length && sent.every((id, slot) => id === ids[slot])) return;
    sentOrderRef.current = ids;
    positions.value = Object.fromEntries(ids.map((id, slot) => [id, slot]));
  }

  function handleDragStart(id) {
    isDraggingRef.current = true;
    swallowClickUntilRef.current = Infinity;
    setLiftedId(id);
  }

  function handleSettled() {
    setLiftedId(null);
  }

  // The drop shows at once; its write lands later, or fails and the cells go back.
  async function handleDragEnd(change) {
    isDraggingRef.current = false;
    // Unless the click came already, during the drag.
    if (swallowClickUntilRef.current === Infinity) swallowClickUntilRef.current = Date.now() + CLICK_AFTER_DROP_MS;
    // The gesture moved the slots itself: whatever arrived during the drag applies now.
    sentOrderRef.current = null;
    if (!change) {
      sendSlots(orderedRef.current.map((row) => row.id));
      return;
    }
    const dropped = { ids: change.order };
    setHold(dropped);
    sendSlots(change.order);
    setIsWriting(true);
    try {
      const writtenAt = await onReorder(change);
      // A drop that reports no write count counts as landed, so the cells follow the rows.
      setHold((current) => (current === dropped ? { ...dropped, writtenAt: writtenAt ?? -1 } : current));
    } catch (error) {
      console.error('Reorder failed', error);
      setHold((current) => (current === dropped ? null : current));
      haptics.error();
      Alert.alert(moveFailedTitle, 'The drop was undone.');
    } finally {
      setIsWriting(false);
    }
  }

  function handleLayout(e) {
    const { height } = e.nativeEvent.layout;
    if (height > 0) setViewportHeight(height);
    dragSelect.onContainerLayout(height);
    dragReorder.onContainerLayout(height);
  }

  if (!ordered) return null;

  return (
    <GestureDetector gesture={gesture}>
      <View ref={containerRef} style={{ flex: 1 }} onLayout={handleLayout}>
        <Animated.ScrollView
          ref={scrollRef}
          keyboardDismissMode="on-drag"
          contentContainerStyle={contentContainerStyle}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          <View style={{ height: gridHeight }}>
            {ordered.slice(firstSlot, endSlot).map((row, i) => (
              <SortableGridCell
                key={row.id}
                row={row}
                renderItem={renderItem}
                initialSlot={firstSlot + i}
                layout={layout}
                cellPadding={cellPadding}
                positions={positions}
                activeId={activeId}
                shownLiftedId={shownLiftedId}
              />
            ))}
            {lifted && (
              <SortableGridLiftedCell
                key={`lifted-${lifted.id}`}
                row={lifted}
                renderItem={renderItem}
                layout={layout}
                cellPadding={cellPadding}
                activeId={activeId}
                activeX={activeX}
                activeY={activeY}
                activeScale={activeScale}
                shownLiftedId={shownLiftedId}
              />
            )}
          </View>
        </Animated.ScrollView>
      </View>
    </GestureDetector>
  );
}
