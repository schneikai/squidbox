import { useMemo, useRef } from 'react';

const EDGE_ZONE = 90; // px from top/bottom where auto-scroll kicks in
const MAX_SCROLL_STEP = 16; // px per tick at the very edge
const SCROLL_TICK_MS = 16;

/**
 * Scrolls a grid while a drag's finger is near its top or bottom edge, faster closer to it, so long
 * grids can be dragged across in one motion (drag-select, drag-reorder). `start` and `move` take the
 * finger in gesture-container space; `onScrolled(x, y)` runs after each step with it, as the content
 * moved under a still finger. `onContainerLayout(height)` gets the container's height.
 */
export default function useEdgeAutoScroll({ listRef, scrollY, onScrolled }) {
  const containerHeightRef = useRef(0);
  const pointRef = useRef({ x: 0, y: 0 });
  const timerRef = useRef(null);
  const onScrolledRef = useRef(onScrolled);
  onScrolledRef.current = onScrolled;

  return useMemo(() => {
    function tick() {
      const { x, y } = pointRef.current;
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
      onScrolledRef.current(x, y);
    }

    return {
      start(x, y) {
        pointRef.current = { x, y };
        if (!timerRef.current) timerRef.current = setInterval(tick, SCROLL_TICK_MS);
      },
      move(x, y) {
        pointRef.current = { x, y };
      },
      stop() {
        clearInterval(timerRef.current);
        timerRef.current = null;
      },
      onContainerLayout(height) {
        containerHeightRef.current = height;
      },
    };
  }, [listRef, scrollY]);
}
