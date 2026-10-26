import { useEffect, useRef, useState } from 'react';
import { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import mergeRowIds from '@/components/sortable-grid/mergeRowIds';
import sameOrder from '@/components/sortable-grid/sameOrder';
import useGridLongPressPan from '@/components/sortable-grid/useGridLongPressPan';
import { DRAG_LIFT_SCALE, DRAG_LONG_PRESS_MS } from '@/constants';
import useHaptics from '@/hooks/useHaptics';
import { motion } from '@/styles/designTokens';

// The press that ends a drag (a click on web) mustn't open the chip it lands on.
const PRESS_AFTER_DROP_MS = 500;

/**
 * Drag-to-move for chips that wrap in rows (a group of prompt buttons), on the grids' long-press
 * pan: a hold lifts the chip under the finger (it pops, `haptics.lift`) and it follows the finger;
 * crossing the middle of another chip moves it there, the others reflowing (their layout
 * transition); the drop (`haptics.drop`) calls `onMove(id, afterId)` with the chip now before it
 * (`null`: first) when that changed. Chips are found by the frames `chipLayout(id)` measures.
 *
 * `order` is the ids to draw: the drag's order while it runs, and the dropped order until `ids`
 * changes (the move's write landed). `liftedId`'s chip leaves a gap that `liftedStyle` (absolute,
 * in the chips' container) fills under the finger. `isPressSuppressed()` is true for the press that
 * ended a drag.
 */
export default function useChipReorder({ ids, onMove }) {
  const haptics = useHaptics();
  const [dragOrder, setDragOrder] = useState(null);
  const [held, setHeld] = useState(null);
  const [liftedId, setLiftedId] = useState(null);
  const framesRef = useRef(new Map());
  // The dragged chip, from lift to release (`liftedId` stays until it has settled).
  const draggingIdRef = useRef(null);
  const orderRef = useRef(ids);
  const startAfterIdRef = useRef(null);
  const grabOffsetRef = useRef({ x: 0, y: 0 });
  const suppressPressUntilRef = useRef(0);
  const liftedX = useSharedValue(0);
  const liftedY = useSharedValue(0);
  const liftedScale = useSharedValue(1);

  // The dropped order holds until the rows have the move (or anything else changed them).
  const idsKey = ids.join(',');
  if (held && held.idsKey !== idsKey) setHeld(null);

  // Chips that arrive or leave during a drag (a sync) join or leave the drag's order.
  useEffect(() => {
    const id = draggingIdRef.current;
    if (!id) return;
    const merged = mergeRowIds(orderRef.current, ids, id);
    if (sameOrder(merged, orderRef.current)) return;
    orderRef.current = merged;
    setDragOrder(merged);
  }, [idsKey]);

  const order = dragOrder ?? (held && held.idsKey === idsKey ? held.order : ids);

  const { gesture, contentPoint, indexAtContent } = useGridLongPressPan({
    enabled: ids.length > 1,
    holdMs: DRAG_LONG_PRESS_MS,
    paddingTop: 0,
    findIndexAt: chipIndexAt,
    onLift(x, y) {
      orderRef.current = [...order];
      const content = contentPoint(x, y);
      const index = indexAtContent(content, orderRef.current.length);
      if (index === -1) return;
      const id = orderRef.current[index];
      const frame = framesRef.current.get(id);
      if (!frame) return;
      draggingIdRef.current = id;
      startAfterIdRef.current = orderRef.current[index - 1] ?? null;
      grabOffsetRef.current = { x: content.x - frame.x, y: content.y - frame.y };
      liftedX.value = frame.x;
      liftedY.value = frame.y;
      liftedScale.value = withSpring(DRAG_LIFT_SCALE, motion.spring);
      suppressPressUntilRef.current = Infinity;
      haptics.lift();
      setLiftedId(id);
      setDragOrder(orderRef.current);
    },
    onMove(x, y) {
      const order = orderRef.current;
      const from = order.indexOf(draggingIdRef.current);
      if (from === -1) return;
      const content = contentPoint(x, y);
      liftedX.value = content.x - grabOffsetRef.current.x;
      liftedY.value = content.y - grabOffsetRef.current.y;
      const to = indexAtContent(content, order.length);
      if (to === -1 || to === from || !isPastMiddle(content, framesRef.current.get(order[to]), to > from)) return;
      const next = [...order];
      next.splice(to, 0, ...next.splice(from, 1));
      orderRef.current = next;
      setDragOrder(next);
    },
    onRelease() {
      const id = draggingIdRef.current;
      if (!id) return;
      draggingIdRef.current = null;
      const order = orderRef.current;
      const afterId = order[order.indexOf(id) - 1] ?? null;
      suppressPressUntilRef.current = Date.now() + PRESS_AFTER_DROP_MS;
      settle(id);
      setDragOrder(null);
      if (afterId === startAfterIdRef.current) return;
      haptics.drop();
      setHeld({ order, idsKey });
      onMove(id, afterId);
    },
  });

  // The lifted chip springs into its slot, then the slot's own chip shows again.
  function settle(id) {
    const frame = framesRef.current.get(id);
    liftedScale.value = withSpring(1, motion.spring);
    if (!frame) {
      setLiftedId(null);
      return;
    }
    liftedX.value = withSpring(frame.x, motion.spring);
    liftedY.value = withSpring(frame.y, motion.spring, (finished) => {
      'worklet';
      if (finished) runOnJS(setLiftedId)(null);
    });
  }

  // The chip whose frame holds the point, or -1.
  function chipIndexAt({ x, y }) {
    return orderRef.current.findIndex((id) => {
      const frame = framesRef.current.get(id);
      return frame && x >= frame.x && x <= frame.x + frame.width && y >= frame.y && y <= frame.y + frame.height;
    });
  }

  function chipLayout(id) {
    return (event) => {
      framesRef.current.set(id, event.nativeEvent.layout);
    };
  }

  const liftedStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    left: 0,
    top: 0,
    transform: [{ translateX: liftedX.value }, { translateY: liftedY.value }, { scale: liftedScale.value }],
  }));

  return {
    order,
    liftedId,
    gesture,
    chipLayout,
    liftedStyle,
    isPressSuppressed: () => Date.now() < suppressPressUntilRef.current,
  };
}

// Whether the finger crossed the middle of the chip it is over, in the direction it moves: a chip
// wider than the lifted one swaps only then, so the swap doesn't flip back under a still finger.
function isPastMiddle(point, frame, isMovingForward) {
  if (!frame) return false;
  const middle = frame.x + frame.width / 2;
  return isMovingForward ? point.x >= middle : point.x <= middle;
}
