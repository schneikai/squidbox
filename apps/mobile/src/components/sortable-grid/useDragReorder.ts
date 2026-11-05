import { useEffect, useRef } from 'react';
import { type SharedValue, withSpring } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import gridSlotOrigin, { type GridLayout, type GridRow } from './gridSlotOrigin';
import isPastTapSlop from './isPastTapSlop';
import mergeRowIds from './mergeRowIds';
import sameOrder from './sameOrder';
import slotPositions from './slotPositions';
import useGridLongPressPan, { type Point, type UseGridLongPressPanOptions } from './useGridLongPressPan';
import usePeekAfterLift, { type UsePeekAfterLiftOptions } from './usePeekAfterLift';

import { DRAG_LIFT_SCALE, DRAG_LONG_PRESS_MS } from '@/constants';
import useHaptics from '@/hooks/useHaptics';
import { motion } from '@/styles/designTokens';

// A drop: the moved row's id, the row it now follows (`null` at the top) and the slots' new order.
export type ReorderChange = { id: string; afterId: string | null; order: string[] };

// The shared values a drag moves, owned by the grid (see useDragReorder).
export type DragValues = {
  positions: SharedValue<Record<string, number>>;
  activeId: SharedValue<string | null>;
  activeX: SharedValue<number>;
  activeY: SharedValue<number>;
  activeScale: SharedValue<number>;
  shownLiftedId: SharedValue<string | null>;
};

export type UseDragReorderOptions<Row extends GridRow> = Pick<
  UseGridLongPressPanOptions,
  'enabled' | 'waitsFor' | 'paddingTop' | 'listRef' | 'scrollY'
> & {
  rows?: Row[];
  layout: GridLayout;
  onDragStart?: (id: string) => void;
  onDragEnd?: (change: ReorderChange | null) => void;
  onSettled?: () => void;
} & DragValues &
  UsePeekAfterLiftOptions<Row>;

// Apple Photos-style drag-to-reorder for a sortable grid (an album's photos, the albums).
//
// A touch-and-hold lifts the cell under the finger (it pops: scales up + shadow)
// and it follows the finger. As the finger crosses into another cell's slot the
// remaining cells reflow to make room via springs. On release the lifted cell
// settles into its new slot and the move is committed as the row it was dropped after.
//
// Positions are driven by shared values owned by the grid:
//   positions  – { [rowId]: slotIndex }  (drives each resting cell)
//   activeId   – id of the lifted cell (or null)
//   activeX/Y  – content-space top-left of the lifted cell (follows finger)
//   activeScale – lift scale
//   shownLiftedId – reset when the lifted cell has settled (see SortableGridLiftedCell)
//
// With `onPeek`, a lifted cell stays put until the finger moves past the tap slop, like a context
// menu's preview that turns into a drag: held still a moment longer it peeks (`onPeek(row)`, until
// `onPeekEnd()` on release or on moving, which drags on from there).
//
// Near the top/bottom edge the list auto-scrolls (useGridLongPressPan). `layout`: see gridSlotOrigin.
// With `waitsFor` (another gesture on the grid, drag-select), a drag starts only once it has failed.
export default function useDragReorder<Row extends GridRow>({
  enabled,
  rows,
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
  onDragStart,
  onDragEnd,
  onSettled,
  onPeek,
  onPeekEnd,
  waitsFor,
}: UseDragReorderOptions<Row>) {
  const haptics = useHaptics();
  const orderRef = useRef<string[]>([]);
  const activeIndexRef = useRef(-1);
  const startAfterIdRef = useRef<string | null>(null);
  const grabOffsetRef = useRef<Point>({ x: 0, y: 0 });
  const liftPointRef = useRef<Point>({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const peek = usePeekAfterLift({ onPeek, onPeekEnd });
  // Called at a spring's end, so read when it runs.
  const deferred = useRef({ onSettled });
  deferred.current.onSettled = onSettled;

  function settled() {
    deferred.current.onSettled?.();
  }

  const { gesture, onContainerLayout, startAutoScroll, contentPoint, indexAtContent } = useGridLongPressPan({
    enabled,
    waitsFor,
    holdMs: DRAG_LONG_PRESS_MS,
    layout,
    paddingTop,
    listRef,
    scrollY,
    onLift(x, y) {
      const loadedRows = rows ?? [];
      orderRef.current = loadedRows.map((row) => row.id);
      const content = contentPoint(x, y);
      const index = indexAtContent(content, orderRef.current.length);
      if (index === -1) return;
      const row = loadedRows[index];
      activeIndexRef.current = index;
      startAfterIdRef.current = orderRef.current[index - 1] ?? null;
      onDragStart?.(row.id);
      haptics.lift();

      const slotOrigin = gridSlotOrigin(layout, index);
      grabOffsetRef.current = { x: content.x - slotOrigin.x, y: content.y - slotOrigin.y };

      activeX.value = slotOrigin.x;
      activeY.value = slotOrigin.y;
      activeScale.value = withSpring(DRAG_LIFT_SCALE, motion.spring);
      activeId.value = row.id;
      liftPointRef.current = { x, y };
      isDraggingRef.current = false;
      if (peek.canPeek) peek.schedule(row);
      else startDragging();
    },
    onMove(x, y) {
      if (activeIndexRef.current === -1) return;
      if (!isDraggingRef.current) {
        if (!isPastTapSlop(liftPointRef.current, x, y, { isPeeking: peek.isPeeking() })) return;
        startDragging();
      }
      const content = contentPoint(x, y);
      activeX.value = content.x - grabOffsetRef.current.x;
      activeY.value = content.y - grabOffsetRef.current.y;
      moveActive(targetIndexAt(content));
    },
    onRelease() {
      peek.end();
      if (activeIndexRef.current === -1) return;
      settleAndCommit();
      activeIndexRef.current = -1;
    },
  });

  // Rows that arrive or leave during a drag (a page the auto-scroll loaded, a synced album) join the
  // drag's slots, so their cells don't overlap others and a drop can land among them.
  useEffect(() => {
    if (activeIndexRef.current === -1 || !rows) return;
    const order = orderRef.current;
    const liftedId = order[activeIndexRef.current];
    const merged = mergeRowIds(
      order,
      rows.map((row) => row.id),
      liftedId,
    );
    if (sameOrder(merged, order)) return;
    orderRef.current = merged;
    activeIndexRef.current = merged.indexOf(liftedId);
    positions.value = slotPositions(merged);
  }, [rows]);

  function targetIndexAt(content: Point) {
    const count = orderRef.current.length;
    const index = indexAtContent(content, count);
    if (index !== -1) return index;
    // Below the last row → clamp to the final slot so dragging past the end drops at the bottom.
    if (content.y >= 0 && count > 0) return count - 1;
    return -1;
  }

  function moveActive(targetIndex: number) {
    const from = activeIndexRef.current;
    if (from === -1 || targetIndex === -1 || targetIndex === from) return;

    const order = orderRef.current;
    const [movedId] = order.splice(from, 1);
    order.splice(targetIndex, 0, movedId);
    activeIndexRef.current = targetIndex;
    positions.value = slotPositions(order);
  }

  function startDragging() {
    isDraggingRef.current = true;
    peek.end();
    startAutoScroll();
  }

  // Settles the lifted cell and reports the drop: the moved row, the loaded row above its new slot
  // (`null` at the top) and the slots' ids in their new order, or `null` when it landed after the
  // same row it started after.
  function settleAndCommit() {
    const slot = activeIndexRef.current;
    const { x, y } = gridSlotOrigin(layout, slot);
    activeScale.value = withSpring(1, motion.spring);
    activeX.value = withSpring(x, motion.spring);
    activeY.value = withSpring(y, motion.spring, (finished) => {
      'worklet';
      if (!finished) return;
      activeId.value = null;
      shownLiftedId.value = null;
      scheduleOnRN(settled);
    });
    const order = orderRef.current;
    const afterId = order[slot - 1] ?? null;
    const change = afterId === startAfterIdRef.current ? null : { id: order[slot], afterId, order: [...order] };
    if (change) haptics.drop();
    onDragEnd?.(change);
  }

  return { gesture, onContainerLayout };
}
