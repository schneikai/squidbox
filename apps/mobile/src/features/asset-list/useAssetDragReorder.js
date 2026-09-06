import { useMemo, useRef } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { withSpring } from 'react-native-reanimated';

import gridIndexAtPoint from './gridIndexAtPoint';

// Apple Photos-style drag-to-reorder for the album asset grid.
//
// A touch-and-hold lifts the cell under the finger (it pops: scales up + shadow)
// and it follows the finger. As the finger crosses into another cell's slot the
// remaining cells reflow to make room via springs. On release the lifted cell
// settles into its new slot and the new order is committed.
//
// Positions are driven by shared values owned by the grid:
//   positions  – { [assetId]: slotIndex }  (drives each resting cell)
//   activeId   – id of the lifted cell (or null)
//   activeX/Y  – content-space top-left of the lifted cell (follows finger)
//   activeScale – lift scale
//
// The edge auto-scroll loop mirrors useAssetDragSelect so long grids can be
// reordered in one motion.

const LONG_PRESS_MS = 150;
const EDGE_ZONE = 90;
const MAX_SCROLL_STEP = 16;
const SCROLL_TICK_MS = 16;
const SPRING = { damping: 20, stiffness: 220, mass: 0.6 };

export default function useAssetDragReorder({
  enabled,
  assetIds,
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
  onReorder,
}) {
  const containerHeightRef = useRef(0);
  const orderRef = useRef([]);
  const activeIndexRef = useRef(-1);
  const grabOffsetRef = useRef({ x: 0, y: 0 });
  const lastPointRef = useRef({ x: 0, y: 0 });
  const autoScrollTimerRef = useRef(null);

  const handlers = useRef({});

  handlers.current.slotToXY = (slot) => ({
    x: (slot % numColumns) * itemSize,
    y: Math.floor(slot / numColumns) * itemSize,
  });

  handlers.current.targetIndexAtPoint = (x, y) => {
    const scrollOffset = scrollY?.value ?? 0;
    const index = gridIndexAtPoint({
      x,
      y,
      scrollOffset,
      paddingTop,
      itemSize,
      numColumns,
      count: orderRef.current.length,
    });
    if (index !== -1) return index;
    // Below the last row but still inside content → clamp to the final slot so
    // dragging past the end drops at the bottom.
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

  handlers.current.stopAutoScroll = () => {
    if (autoScrollTimerRef.current) {
      clearInterval(autoScrollTimerRef.current);
      autoScrollTimerRef.current = null;
    }
  };

  handlers.current.tickAutoScroll = () => {
    const { x, y } = lastPointRef.current;
    const height = containerHeightRef.current;
    let delta = 0;
    if (y < EDGE_ZONE) {
      delta = -MAX_SCROLL_STEP * (1 - Math.max(y, 0) / EDGE_ZONE);
    } else if (height > 0 && y > height - EDGE_ZONE) {
      delta = MAX_SCROLL_STEP * (1 - Math.max(height - y, 0) / EDGE_ZONE);
    }
    if (delta === 0) return;

    const next = Math.max(0, (scrollY?.value ?? 0) + delta);
    listRef?.current?.scrollToOffset?.({ offset: next, animated: false });
    handlers.current.updateFromPoint(x, y);
  };

  handlers.current.ensureAutoScroll = () => {
    if (autoScrollTimerRef.current) return;
    autoScrollTimerRef.current = setInterval(handlers.current.tickAutoScroll, SCROLL_TICK_MS);
  };

  handlers.current.settleAndCommit = () => {
    const slot = activeIndexRef.current;
    if (slot === -1) return;
    const { x, y } = handlers.current.slotToXY(slot);
    activeScale.value = withSpring(1, SPRING);
    activeX.value = withSpring(x, SPRING);
    activeY.value = withSpring(y, SPRING, (finished) => {
      'worklet';
      if (finished) activeId.value = null;
    });
    onReorder?.([...orderRef.current]);
  };

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(enabled)
        .activateAfterLongPress(LONG_PRESS_MS)
        .runOnJS(true)
        .onStart((e) => {
          lastPointRef.current = { x: e.x, y: e.y };
          orderRef.current = [...assetIds];
          const index = gridIndexAtPoint({
            x: e.x,
            y: e.y,
            scrollOffset: scrollY?.value ?? 0,
            paddingTop,
            itemSize,
            numColumns,
            count: orderRef.current.length,
          });
          if (index === -1) {
            activeIndexRef.current = -1;
            return;
          }
          activeIndexRef.current = index;

          const { x: slotX, y: slotY } = handlers.current.slotToXY(index);
          const contentX = e.x;
          const contentY = e.y + (scrollY?.value ?? 0) - paddingTop;
          grabOffsetRef.current = { x: contentX - slotX, y: contentY - slotY };

          activeX.value = slotX;
          activeY.value = slotY;
          activeScale.value = withSpring(1.08, SPRING);
          activeId.value = orderRef.current[index];
          handlers.current.ensureAutoScroll();
        })
        .onUpdate((e) => {
          if (activeIndexRef.current === -1) return;
          lastPointRef.current = { x: e.x, y: e.y };
          handlers.current.updateFromPoint(e.x, e.y);
        })
        .onFinalize(() => {
          handlers.current.stopAutoScroll();
          if (activeIndexRef.current !== -1) {
            handlers.current.settleAndCommit();
          } else {
            activeId.value = null;
          }
          activeIndexRef.current = -1;
        }),
    [enabled, assetIds, numColumns, itemSize, paddingTop, listRef, scrollY, onReorder],
  );

  function onContainerLayout(height) {
    containerHeightRef.current = height;
  }

  return { gesture, onContainerLayout };
}
