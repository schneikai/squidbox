import { useEffect, useRef } from 'react';
import { runOnJS, withSpring } from 'react-native-reanimated';

import gridSlotOrigin from './gridSlotOrigin';
import mergeRowIds from './mergeRowIds';
import sameOrder from './sameOrder';
import slotPositions from './slotPositions';
import useGridLongPressPan from './useGridLongPressPan';

import { TAP_SLOP } from '@/constants';
import useHaptics from '@/hooks/useHaptics';
import { motion } from '@/styles/designTokens';

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

// Longer than a slow tap, so a tap always opens what it lands on (UIKit's long press is 500 ms).
const LONG_PRESS_MS = 400;
// After the lift, so a drag that starts right away never flashes the quick view first.
const PEEK_AFTER_LIFT_MS = 400;

export default function useDragReorder({
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
}) {
  const haptics = useHaptics();
  const orderRef = useRef([]);
  const activeIndexRef = useRef(-1);
  const startAfterIdRef = useRef(null);
  const grabOffsetRef = useRef({ x: 0, y: 0 });
  const liftPointRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const peekTimerRef = useRef(null);
  const isPeekingRef = useRef(false);

  const canPeek = Boolean(onPeek);
  // Called later (after a timer, at a spring's end, from endPeek), so read when they run.
  const deferred = useRef({});
  deferred.current = { onPeek, onPeekEnd, onSettled };

  function settled() {
    deferred.current.onSettled?.();
  }

  function endPeek() {
    clearTimeout(peekTimerRef.current);
    if (!isPeekingRef.current) return;
    isPeekingRef.current = false;
    deferred.current.onPeekEnd?.();
  }

  const { gesture, onContainerLayout, startAutoScroll, contentPoint, indexAtContent } = useGridLongPressPan({
    enabled,
    holdMs: LONG_PRESS_MS,
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
      activeScale.value = withSpring(1.08, motion.spring);
      activeId.value = row.id;
      liftPointRef.current = { x, y };
      isDraggingRef.current = false;
      if (canPeek) {
        peekTimerRef.current = setTimeout(() => {
          isPeekingRef.current = true;
          deferred.current.onPeek?.(row);
        }, PEEK_AFTER_LIFT_MS);
      } else {
        startDragging();
      }
    },
    onMove(x, y) {
      if (activeIndexRef.current === -1) return;
      if (!isDraggingRef.current) {
        if (!isPastTapSlop(liftPointRef.current, x, y)) return;
        startDragging();
      }
      const content = contentPoint(x, y);
      activeX.value = content.x - grabOffsetRef.current.x;
      activeY.value = content.y - grabOffsetRef.current.y;
      moveActive(targetIndexAt(content));
    },
    onRelease() {
      endPeek();
      if (activeIndexRef.current === -1) return;
      settleAndCommit();
      activeIndexRef.current = -1;
    },
  });

  useEffect(() => () => clearTimeout(peekTimerRef.current), []);

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

  function targetIndexAt(content) {
    const count = orderRef.current.length;
    const index = indexAtContent(content, count);
    if (index !== -1) return index;
    // Below the last row → clamp to the final slot so dragging past the end drops at the bottom.
    if (content.y >= 0 && count > 0) return count - 1;
    return -1;
  }

  function moveActive(targetIndex) {
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
    endPeek();
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
      runOnJS(settled)();
    });
    const order = orderRef.current;
    const afterId = order[slot - 1] ?? null;
    const change = afterId === startAfterIdRef.current ? null : { id: order[slot], afterId, order: [...order] };
    if (change) haptics.drop();
    onDragEnd?.(change);
  }

  return { gesture, onContainerLayout };
}

// Whether the finger at (x, y) left the point it lifted the cell at by more than a tap's slop, so a
// held finger's tremor still peeks.
function isPastTapSlop(liftPoint, x, y) {
  return Math.hypot(x - liftPoint.x, y - liftPoint.y) > TAP_SLOP;
}
