import {
  type ComponentRef,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Alert, type LayoutChangeEvent, Platform, View, useWindowDimensions } from 'react-native';
import { GestureDetector, useCompetingGestures } from 'react-native-gesture-handler';
import Animated, {
  type ScrollHandlerProcessed,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useComposedEventHandler,
  useSharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import SortableGridCell from './SortableGridCell';
import SortableGridLiftedCell from './SortableGridLiftedCell';
import type { GridRow } from './gridSlotOrigin';
import heldOrder, { type Hold } from './heldOrder';
import slotPositions from './slotPositions';
import useDragReorder, { type ReorderChange } from './useDragReorder';
import useDragSelect from './useDragSelect';
import type { UsePeekAfterLiftOptions } from './usePeekAfterLift';

import useHaptics from '@/hooks/useHaptics';
import type { ScrollableList } from '@/hooks/useListControls';
import useScrollingHeader from '@/hooks/useScrollingHeader';
import sameOrder from '@/lib/sameOrder';

// A grid whose cells can be dragged into a new order, Apple Photos-style (an album's photos, the
// albums). Cells are absolutely positioned so they can be dragged and reflowed, and only the rows
// within WINDOW_SCREENS screens of the viewport are mounted, like a FlatList's window. With `onPeek`,
// a lifted cell held still peeks instead (see useDragReorder). `header` sits above the cells and
// scrolls with them (an album's name and chips).
const WINDOW_SCREENS = 2;
// How long after a drop its click may still come (it follows the pointer's release at once).
const CLICK_AFTER_DROP_MS = 500;

export type SortableGridProps<Row extends GridRow> = {
  rows?: Row[];
  rowsReadAt?: number;
  loadMore?: () => void;
  renderItem: (row: Row) => ReactNode;
  numColumns: number;
  gap?: number;
  cellHeight?: number;
  cellPadding?: number;
  paddingTop?: number;
  paddingBottom?: number;
  header?: ReactNode;
  listRef?: RefObject<ScrollableList | null>;
  onScroll?: ScrollHandlerProcessed;
  dragSelectEnabled?: boolean;
  dragSelectLocksSwipeBack?: boolean;
  selectedIds?: string[];
  onSelect?: (ids: string[]) => void;
  reorderEnabled?: boolean;
  // Resolves to the drop's write count (see heldOrder), or nothing.
  onReorder?: (change: ReorderChange) => Promise<number | void>;
  moveFailedTitle: string;
} & UsePeekAfterLiftOptions<Row>;
export default function SortableGrid<Row extends GridRow>({
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
  header,
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
}: SortableGridProps<Row>) {
  const window = useWindowDimensions();
  const haptics = useHaptics();
  const cellWidth = (window.width - gap * (numColumns + 1)) / numColumns;
  const layout = useMemo(
    () => ({ numColumns, cellWidth, cellHeight: cellHeight ?? cellWidth, gap }),
    [numColumns, cellWidth, cellHeight, gap],
  );

  const { headerView, cellsTop } = useScrollingHeader(header, paddingTop);

  // The grid's own offset, for the window of mounted cells and the drag gestures.
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
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
      scheduleOnRN(askForMore);
    }
  });
  const handleScroll = useComposedEventHandler([trackScroll, onScroll ?? null]);

  // The mounted window moves a screen at a time: the screen the viewport's top is in.
  const [viewportHeight, setViewportHeight] = useState(window.height);
  const [screenIndex, setScreenIndex] = useState(0);
  useAnimatedReaction(
    () => Math.floor(scrollY.value / viewportHeight),
    (index, prev) => {
      if (index !== prev) scheduleOnRN(setScreenIndex, index);
    },
  );

  // Reorder animation state (shared with the cells + the reorder gesture hook).
  const positions = useSharedValue<Record<string, number>>({});
  const activeId = useSharedValue<string | null>(null);
  const activeX = useSharedValue(0);
  const activeY = useSharedValue(0);
  const activeScale = useSharedValue(1);
  const shownLiftedId = useSharedValue<string | null>(null);
  const [liftedId, setLiftedId] = useState<string | null>(null);

  const containerRef = useRef<ComponentRef<typeof View>>(null);
  const swallowClickUntilRef = useRef(0);

  // After a drop the cells and the gestures hold the order it left until rows that include its write
  // land (heldOrder): the rows until then would spring the cells back and let the next drag lift the
  // wrong cell. While a drag runs, the gesture owns the slots; rows arriving meanwhile apply after it.
  const [hold, setHold] = useState<Hold | null>(null);
  // One reorder at a time: a drag waits until the previous drop's write has settled, so each drop is
  // made on an order the database has (a failed first drop would leave the second on a guessed one).
  const [isWriting, setIsWriting] = useState(false);
  const isDraggingRef = useRef(false);
  const sentOrderRef = useRef<string[] | null>(null);
  const ordered = useMemo(() => {
    const heldIds = rows && heldOrder(hold, rows, rowsReadAt, reorderEnabled);
    if (!heldIds) return rows;
    const byId = new Map(rows.map((row) => [row.id, row]));
    // heldOrder keeps only the rows' ids, so every one is found.
    return heldIds.map((id) => {
      const row = byId.get(id);
      if (!row) throw new Error(`SortableGrid: held id ${id} is not in the rows`);
      return row;
    });
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
    // On web the View's ref is the DOM element (react-native-web); the check below guards it.
    const node = containerRef.current as unknown as HTMLElement | null;
    if (Platform.OS !== 'web' || !node?.addEventListener) return undefined;
    function swallowClick(event: Event) {
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
    paddingTop: cellsTop,
    listRef,
    scrollY,
    selectedIdsRef,
    onSelect,
    locksSwipeBack: dragSelectLocksSwipeBack,
    onPeek,
    onPeekEnd,
  });

  const dragReorder = useDragReorder({
    enabled: reorderEnabled && !isWriting,
    rows: ordered,
    layout,
    paddingTop: cellsTop,
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
    // Drag-select first, while it's on. Not an Exclusive composition: a disabled gesture in one still
    // makes the other wait for it on web, so reordering would never start.
    waitsFor: dragSelectEnabled ? dragSelect.gesture : undefined,
  });

  // One composition whatever is on: a detector handed a different one while mounted doesn't attach
  // the new gestures. Competing, so the first to start wins; `waitsFor` orders them.
  const gesture = useCompetingGestures(dragSelect.gesture, dragReorder.gesture);
  const contentContainerStyle = useMemo(() => ({ paddingTop, paddingBottom }), [paddingTop, paddingBottom]);

  const rowPitch = layout.cellHeight + layout.gap;
  const gridHeight = Math.ceil((rows?.length ?? 0) / numColumns) * rowPitch;
  const windowTop = (screenIndex - WINDOW_SCREENS) * viewportHeight - cellsTop;
  const windowBottom = (screenIndex + 1 + WINDOW_SCREENS) * viewportHeight - cellsTop;
  const firstSlot = Math.max(0, Math.floor(windowTop / rowPitch)) * numColumns;
  const endSlot = Math.max(0, Math.ceil(windowBottom / rowPitch)) * numColumns;
  const lifted = useMemo(() => liftedId && ordered?.find((row) => row.id === liftedId), [liftedId, ordered]);

  // The slots go to the UI thread only when the order changed, not for every new rows array.
  function sendSlots(ids: string[]) {
    const sent = sentOrderRef.current;
    if (sent && sameOrder(sent, ids)) return;
    sentOrderRef.current = ids;
    positions.value = slotPositions(ids);
  }

  function handleDragStart(id: string) {
    isDraggingRef.current = true;
    swallowClickUntilRef.current = Infinity;
    setLiftedId(id);
  }

  function handleSettled() {
    setLiftedId(null);
  }

  // The drop shows at once; its write lands later, or fails and the cells go back.
  async function handleDragEnd(change: ReorderChange | null) {
    isDraggingRef.current = false;
    // Unless the click came already, during the drag.
    if (swallowClickUntilRef.current === Infinity) swallowClickUntilRef.current = Date.now() + CLICK_AFTER_DROP_MS;
    // The gesture moved the slots itself: whatever arrived during the drag applies now.
    sentOrderRef.current = null;
    if (!change) {
      // A drag needs rows, so they are there.
      if (orderedRef.current) sendSlots(orderedRef.current.map((row) => row.id));
      return;
    }
    const dropped: Hold = { ids: change.order };
    setHold(dropped);
    sendSlots(change.order);
    setIsWriting(true);
    try {
      if (!onReorder) throw new Error('SortableGrid: reorderEnabled needs onReorder');
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

  function handleLayout(e: LayoutChangeEvent) {
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
          {headerView}
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
