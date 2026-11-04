import { useNavigation } from 'expo-router';
import { useEffect, useRef } from 'react';

import isPastTapSlop from './isPastTapSlop';
import useGridLongPressPan from './useGridLongPressPan';

import { PEEK_AFTER_LIFT_MS } from '@/constants';
import useHaptics from '@/hooks/useHaptics';

// Apple Photos-style drag-to-select for a grid (the asset grids).
//
// While in select mode, a short hold begins a marquee drag: the cell you start
// on is the anchor, and the whole contiguous range (in row-major order) between
// the anchor and the cell under your finger is selected — so dragging down fills
// entire rows, not just the cells the finger crosses. Dragging back shrinks the
// range, restoring items to their pre-drag state. The anchor's initial state
// decides whether the drag adds or removes (select vs deselect).
//
// With `onPeek`, the range starts only once the finger moves past the tap slop: held still a moment
// longer it peeks at the cell (`onPeek(row)`, until `onPeekEnd()` on release or on moving, which
// selects on from there), like Photos' preview in select mode. Let go before the peek, the cell is
// selected as before; after it, nothing changes.
//
// Near the top/bottom edge the list auto-scrolls (useGridLongPressPan). `layout`: the grid's cells,
// see gridSlotOrigin. `locksSwipeBack: false` for a grid that is a sheet's own screen, see below.

const LONG_PRESS_MS = 150; // hold before selecting starts (keeps normal flicks scrolling)

export default function useDragSelect({
  enabled,
  rows,
  layout,
  paddingTop,
  listRef,
  scrollY,
  selectedIdsRef,
  onSelect,
  locksSwipeBack = true,
  onPeek,
  onPeekEnd,
}) {
  const navigation = useNavigation();
  const haptics = useHaptics();

  // A drag can start in the grid's first column, where iOS's swipe-back gesture also starts. Turn
  // swipe-back off while drag-select is on, so the drag selects instead of leaving the screen. A
  // sheet's own screen has no swipe-back, and there the option would stop the swipe down that closes it.
  useEffect(() => {
    if (!enabled || !locksSwipeBack) return;
    navigation.setOptions({ gestureEnabled: false });
    return () => navigation.setOptions({ gestureEnabled: true });
  }, [navigation, enabled, locksSwipeBack]);

  const baseSelectedRef = useRef([]);
  const anchorIndexRef = useRef(-1);
  const currentIndexRef = useRef(-1);
  const intentRef = useRef(true); // true = add to selection, false = remove
  const liftPointRef = useRef({ x: 0, y: 0 });
  const isSelectingRef = useRef(false);
  const peekTimerRef = useRef(null);
  const isPeekingRef = useRef(false);
  // Called after a timer, so read when they run.
  const deferred = useRef({});
  deferred.current = { onPeek, onPeekEnd };
  // Indices past the loaded rows (a page the auto-scroll is still loading) select nothing.
  const loadedRows = rows ?? [];

  const { gesture, onContainerLayout, startAutoScroll, contentPoint, indexAtContent } = useGridLongPressPan({
    enabled,
    holdMs: LONG_PRESS_MS,
    layout,
    paddingTop,
    listRef,
    scrollY,
    onLift(x, y) {
      const index = indexAtContent(contentPoint(x, y), loadedRows.length);
      if (index === -1) return;
      baseSelectedRef.current = selectedIdsRef.current ?? [];
      anchorIndexRef.current = index;
      currentIndexRef.current = index;
      intentRef.current = !baseSelectedRef.current.includes(loadedRows[index].id);
      liftPointRef.current = { x, y };
      isSelectingRef.current = false;
      if (!onPeek) {
        startSelecting();
        return;
      }
      const row = loadedRows[index];
      peekTimerRef.current = setTimeout(() => {
        isPeekingRef.current = true;
        deferred.current.onPeek?.(row);
      }, PEEK_AFTER_LIFT_MS);
    },
    onMove(x, y) {
      if (anchorIndexRef.current === -1) return;
      if (!isSelectingRef.current) {
        if (!isPastTapSlop(liftPointRef.current, x, y)) return;
        startSelecting();
      }
      const index = indexAtContent(contentPoint(x, y), loadedRows.length);
      if (index === -1 || index === currentIndexRef.current) return;
      currentIndexRef.current = index;
      applyRange(index);
    },
    onRelease() {
      const wasPeeking = isPeekingRef.current;
      endPeek();
      if (anchorIndexRef.current !== -1 && !isSelectingRef.current && !wasPeeking) startSelecting();
      anchorIndexRef.current = -1;
      currentIndexRef.current = -1;
    },
  });

  useEffect(() => () => clearTimeout(peekTimerRef.current), []);

  // Selects the anchor and from then on the range to the finger, scrolling near an edge.
  function startSelecting() {
    endPeek();
    isSelectingRef.current = true;
    applyRange(anchorIndexRef.current);
    haptics.selection();
    startAutoScroll();
  }

  function endPeek() {
    clearTimeout(peekTimerRef.current);
    if (!isPeekingRef.current) return;
    isPeekingRef.current = false;
    deferred.current.onPeekEnd?.();
  }

  function applyRange(currentIndex) {
    const anchor = anchorIndexRef.current;
    if (anchor === -1 || currentIndex === -1) return;

    const lo = Math.min(anchor, currentIndex);
    const hi = Math.max(anchor, currentIndex);
    const set = new Set(baseSelectedRef.current);
    for (let i = lo; i <= hi; i++) {
      const id = loadedRows[i]?.id;
      if (!id) continue;
      if (intentRef.current) set.add(id);
      else set.delete(id);
    }
    onSelect([...set]);
  }

  return { gesture, onContainerLayout };
}
