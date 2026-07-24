import { useMemo, useRef } from 'react';
import { Gesture } from 'react-native-gesture-handler';

// Apple Photos-style drag-to-select for the asset grid.
//
// While in select mode, a short hold begins a marquee drag: the cell you start
// on is the anchor, and the whole contiguous range (in row-major order) between
// the anchor and the cell under your finger is selected — so dragging down fills
// entire rows, not just the cells the finger crosses. Dragging back shrinks the
// range, restoring items to their pre-drag state. The anchor's initial state
// decides whether the drag adds or removes (select vs deselect).
//
// When the finger nears the top/bottom edge the list auto-scrolls so long grids
// can be selected in one motion.

const LONG_PRESS_MS = 150; // hold before selecting starts (keeps normal flicks scrolling)
const EDGE_ZONE = 90; // px from top/bottom where auto-scroll kicks in
const MAX_SCROLL_STEP = 16; // px per tick at the very edge
const SCROLL_TICK_MS = 16;

export default function useAssetDragSelect({
  enabled,
  assetIds,
  numColumns,
  itemSize,
  paddingTop,
  listRef,
  scrollY,
  selectedIdsRef,
  selectAssets,
}) {
  const containerHeightRef = useRef(0);
  const baseSelectedRef = useRef([]);
  const anchorIndexRef = useRef(-1);
  const currentIndexRef = useRef(-1);
  const intentRef = useRef(true); // true = add to selection, false = remove
  const lastPointRef = useRef({ x: 0, y: 0 });
  const autoScrollTimerRef = useRef(null);

  const handlers = useRef({});

  handlers.current.indexAtPoint = (x, y) => {
    const offset = scrollY?.value ?? 0;
    const col = Math.min(Math.max(Math.floor(x / itemSize), 0), numColumns - 1);
    const contentY = y + offset - paddingTop;
    if (contentY < 0) return -1;
    const row = Math.floor(contentY / itemSize);
    const index = row * numColumns + col;
    if (index < 0 || index >= assetIds.length) return -1;
    return index;
  };

  handlers.current.applyRange = (currentIndex) => {
    const anchor = anchorIndexRef.current;
    if (anchor === -1 || currentIndex === -1) return;

    const lo = Math.min(anchor, currentIndex);
    const hi = Math.max(anchor, currentIndex);
    const set = new Set(baseSelectedRef.current);
    for (let i = lo; i <= hi; i++) {
      const id = assetIds[i];
      if (!id) continue;
      if (intentRef.current) set.add(id);
      else set.delete(id);
    }
    selectAssets([...set]);
  };

  handlers.current.updateFromPoint = (x, y) => {
    const index = handlers.current.indexAtPoint(x, y);
    if (index === -1 || index === currentIndexRef.current) return;
    currentIndexRef.current = index;
    handlers.current.applyRange(index);
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

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(enabled)
        .activateAfterLongPress(LONG_PRESS_MS)
        .runOnJS(true)
        .onStart((e) => {
          lastPointRef.current = { x: e.x, y: e.y };
          const index = handlers.current.indexAtPoint(e.x, e.y);
          if (index === -1) {
            anchorIndexRef.current = -1;
            return;
          }
          baseSelectedRef.current = selectedIdsRef.current ?? [];
          anchorIndexRef.current = index;
          currentIndexRef.current = index;
          intentRef.current = !baseSelectedRef.current.includes(assetIds[index]);
          handlers.current.applyRange(index);
          handlers.current.ensureAutoScroll();
        })
        .onUpdate((e) => {
          lastPointRef.current = { x: e.x, y: e.y };
          handlers.current.updateFromPoint(e.x, e.y);
        })
        .onFinalize(() => {
          handlers.current.stopAutoScroll();
          anchorIndexRef.current = -1;
          currentIndexRef.current = -1;
        }),
    [enabled, assetIds, selectedIdsRef, selectAssets],
  );

  function onContainerLayout(height) {
    containerHeightRef.current = height;
  }

  return { gesture, onContainerLayout };
}
