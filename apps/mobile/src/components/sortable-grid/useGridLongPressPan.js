import { useEffect, useMemo, useRef } from 'react';
import { Gesture } from 'react-native-gesture-handler';

const EDGE_ZONE = 90; // px from top/bottom where auto-scroll kicks in
const MAX_SCROLL_STEP = 16; // px per tick at the very edge
const SCROLL_TICK_MS = 16;

/**
 * The pan a grid's drags share (drag-select, drag-reorder): it starts after a hold of `holdMs` and
 * runs on JS. `onLift(x, y)` on start, `onMove(x, y)` on every move and after every auto-scroll step
 * (the content moved under a still finger), `onRelease()` at the end. Points are in the gesture
 * container's space; `contentPoint` turns them into the scrolled grid's, and `indexAtContent` finds the cell there. Once
 * `startAutoScroll()` runs, the list scrolls while the finger is near its top or bottom edge,
 * faster closer to it, until the release, so long grids can be dragged across in one motion.
 * `onContainerLayout(height)` gets the container's height. `layout`: see gridSlotOrigin. Items
 * that aren't grid cells (chips that wrap) pass `findIndexAt(contentPoint, count)` instead.
 *
 * The callbacks are read when the gesture calls them, so new rows or callbacks don't rebuild the
 * gesture mid-drag. Work a callback schedules for later (a timer, a spring's end) still sees the
 * render it ran in.
 */
export default function useGridLongPressPan({
  enabled,
  holdMs,
  layout,
  paddingTop,
  listRef,
  scrollY,
  findIndexAt,
  onLift,
  onMove,
  onRelease,
}) {
  const handlers = useRef({});
  handlers.current = { onLift, onMove, onRelease };
  const containerHeightRef = useRef(0);
  const pointRef = useRef({ x: 0, y: 0 });
  const timerRef = useRef(null);
  const liftedRef = useRef(false);
  useEffect(() => () => clearInterval(timerRef.current), []);

  function contentPoint(x, y) {
    return { x, y: y + (scrollY?.value ?? 0) - (paddingTop ?? 0) };
  }

  function indexAtContent(content, count) {
    return findIndexAt ? findIndexAt(content, count) : gridIndexAtContentPoint(content, layout, count);
  }

  // Reads only refs and the list, so the tick an interval started with stays valid.
  function tick() {
    const { x, y } = pointRef.current;
    const delta = edgeScrollStep(y, containerHeightRef.current);
    if (delta === 0) return;
    const offset = scrollY?.value ?? 0;
    const next = Math.max(0, offset + delta);
    if (next === offset) return;
    listRef?.current?.scrollToOffset?.({ offset: next, animated: false });
    handlers.current.onMove(x, y);
  }

  function startAutoScroll() {
    if (!timerRef.current) timerRef.current = setInterval(tick, SCROLL_TICK_MS);
  }

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(enabled)
        .activateAfterLongPress(holdMs)
        .runOnJS(true)
        .onStart((e) => {
          liftedRef.current = true;
          pointRef.current = { x: e.x, y: e.y };
          handlers.current.onLift(e.x, e.y);
        })
        .onUpdate((e) => {
          pointRef.current = { x: e.x, y: e.y };
          handlers.current.onMove(e.x, e.y);
        })
        // Also runs for touches that never lifted (a tap), which have nothing to release.
        .onFinalize(() => {
          clearInterval(timerRef.current);
          timerRef.current = null;
          if (!liftedRef.current) return;
          liftedRef.current = false;
          handlers.current.onRelease();
        }),
    [enabled, holdMs],
  );

  return {
    gesture,
    onContainerLayout: (height) => {
      containerHeightRef.current = height;
    },
    startAutoScroll,
    contentPoint,
    indexAtContent,
  };
}

// The auto-scroll's step for a finger at `y` in a container `height` tall: up or down near an edge,
// faster closer to it, 0 elsewhere.
function edgeScrollStep(y, height) {
  if (y < EDGE_ZONE) return -MAX_SCROLL_STEP * (1 - Math.max(y, 0) / EDGE_ZONE);
  if (height > 0 && y > height - EDGE_ZONE) return MAX_SCROLL_STEP * (1 - Math.max(height - y, 0) / EDGE_ZONE);
  return 0;
}

// The flat index of the cell at a content-space point (a point in a gap counts for the nearer cell),
// or -1 above the grid or past its `count` cells.
function gridIndexAtContentPoint({ x, y }, layout, count) {
  const { numColumns, cellWidth, cellHeight, gap } = layout;
  if (y < 0) return -1;
  const col = Math.min(Math.max(Math.floor((x - gap / 2) / (cellWidth + gap)), 0), numColumns - 1);
  const row = Math.floor((y + gap / 2) / (cellHeight + gap));
  const index = row * numColumns + col;
  if (index < 0 || index >= count) return -1;
  return index;
}
