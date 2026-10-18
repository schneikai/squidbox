import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { runOnJS, withSpring } from 'react-native-reanimated';

import gridIndexAtPoint from './gridIndexAtPoint';
import gridSlotOrigin from './gridSlotOrigin';
import mergeRowIds from './mergeRowIds';
import useEdgeAutoScroll from './useEdgeAutoScroll';

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
// Near the top/bottom edge the list auto-scrolls (useEdgeAutoScroll). `layout`: see gridSlotOrigin.

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

  // Rows and callbacks are read through the handlers, so a rows update or a new callback doesn't
  // rebuild the gesture mid-drag.
  const handlers = useRef({});
  handlers.current.rows = rows ?? [];
  handlers.current.onDragStart = onDragStart;
  handlers.current.onDragEnd = onDragEnd;
  handlers.current.onSettled = onSettled;
  handlers.current.onPeek = onPeek;
  handlers.current.onPeekEnd = onPeekEnd;
  const settled = useCallback(() => handlers.current.onSettled?.(), []);
  const endPeek = useCallback(() => {
    clearTimeout(peekTimerRef.current);
    if (!isPeekingRef.current) return;
    isPeekingRef.current = false;
    handlers.current.onPeekEnd?.();
  }, []);

  const autoScroll = useEdgeAutoScroll({
    listRef,
    scrollY,
    onScrolled: (x, y) => handlers.current.updateFromPoint(x, y),
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
    if (merged.length === order.length && merged.every((id, slot) => id === order[slot])) return;
    orderRef.current = merged;
    activeIndexRef.current = merged.indexOf(liftedId);
    positions.value = Object.fromEntries(merged.map((id, slot) => [id, slot]));
  }, [rows]);

  handlers.current.targetIndexAtPoint = (x, y) => {
    const scrollOffset = scrollY?.value ?? 0;
    const index = gridIndexAtPoint({
      x,
      y,
      scrollOffset,
      paddingTop,
      layout,
      count: orderRef.current.length,
    });
    if (index !== -1) return index;
    // Below the last row → clamp to the final slot so dragging past the end drops at the bottom.
    const contentY = y + scrollOffset - paddingTop;
    if (contentY >= 0 && orderRef.current.length > 0) return orderRef.current.length - 1;
    return -1;
  };

  handlers.current.moveActive = (targetIndex) => {
    const from = activeIndexRef.current;
    if (from === -1 || targetIndex === -1 || targetIndex === from) return;

    const order = orderRef.current;
    const [movedId] = order.splice(from, 1);
    order.splice(targetIndex, 0, movedId);
    activeIndexRef.current = targetIndex;

    const next = {};
    order.forEach((id, slot) => {
      next[id] = slot;
    });
    positions.value = next;
  };

  handlers.current.updateFromPoint = (x, y) => {
    const scrollOffset = scrollY?.value ?? 0;
    const contentX = x;
    const contentY = y + scrollOffset - paddingTop;
    activeX.value = contentX - grabOffsetRef.current.x;
    activeY.value = contentY - grabOffsetRef.current.y;
    handlers.current.moveActive(handlers.current.targetIndexAtPoint(x, y));
  };

  // Settles the lifted cell and reports the drop: the moved row and the loaded row above its new
  // slot (`null` at the top), or `null` when it landed after the same row it started after.
  handlers.current.settleAndCommit = () => {
    const slot = activeIndexRef.current;
    if (slot === -1) return;
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
    const change = afterId === startAfterIdRef.current ? null : { id: order[slot], afterId };
    if (change) haptics.drop();
    handlers.current.onDragEnd?.(change);
  };

  const startDragging = useCallback(
    (x, y) => {
      isDraggingRef.current = true;
      endPeek();
      autoScroll.start(x, y);
    },
    [autoScroll, endPeek],
  );

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(enabled)
        .activateAfterLongPress(LONG_PRESS_MS)
        .runOnJS(true)
        .onStart((e) => {
          orderRef.current = handlers.current.rows.map((row) => row.id);
          const index = gridIndexAtPoint({
            x: e.x,
            y: e.y,
            scrollOffset: scrollY?.value ?? 0,
            paddingTop,
            layout,
            count: orderRef.current.length,
          });
          if (index === -1) {
            activeIndexRef.current = -1;
            return;
          }
          const row = handlers.current.rows[index];
          activeIndexRef.current = index;
          startAfterIdRef.current = orderRef.current[index - 1] ?? null;
          handlers.current.onDragStart?.(row.id);
          haptics.lift();

          const { x: slotX, y: slotY } = gridSlotOrigin(layout, index);
          const contentX = e.x;
          const contentY = e.y + (scrollY?.value ?? 0) - paddingTop;
          grabOffsetRef.current = { x: contentX - slotX, y: contentY - slotY };

          activeX.value = slotX;
          activeY.value = slotY;
          activeScale.value = withSpring(1.08, motion.spring);
          activeId.value = row.id;
          liftPointRef.current = { x: e.x, y: e.y };
          isDraggingRef.current = false;
          if (canPeek) {
            peekTimerRef.current = setTimeout(() => {
              isPeekingRef.current = true;
              handlers.current.onPeek?.(row);
            }, PEEK_AFTER_LIFT_MS);
          } else {
            startDragging(e.x, e.y);
          }
        })
        .onUpdate((e) => {
          if (activeIndexRef.current === -1) return;
          if (!isDraggingRef.current) {
            if (!isPastTapSlop(liftPointRef.current, e.x, e.y)) return;
            startDragging(e.x, e.y);
          }
          autoScroll.move(e.x, e.y);
          handlers.current.updateFromPoint(e.x, e.y);
        })
        .onFinalize(() => {
          endPeek();
          autoScroll.stop();
          if (activeIndexRef.current !== -1) {
            handlers.current.settleAndCommit();
          } else {
            activeId.value = null;
          }
          activeIndexRef.current = -1;
        }),
    [enabled, canPeek, layout, paddingTop, scrollY, autoScroll, haptics, endPeek, startDragging],
  );

  return { gesture, onContainerLayout: autoScroll.onContainerLayout };
}

// Whether the finger at (x, y) left the point it lifted the cell at by more than a tap's slop, so a
// held finger's tremor still peeks.
function isPastTapSlop(liftPoint, x, y) {
  return Math.hypot(x - liftPoint.x, y - liftPoint.y) > TAP_SLOP;
}
