import { useNavigation } from '@react-navigation/native';
import { useEffect, useRef } from 'react';

import useGridLongPressPan from './useGridLongPressPan';

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
      applyRange(index);
      haptics.selection();
      startAutoScroll();
    },
    onMove(x, y) {
      const index = indexAtContent(contentPoint(x, y), loadedRows.length);
      if (index === -1 || index === currentIndexRef.current) return;
      currentIndexRef.current = index;
      applyRange(index);
    },
    onRelease() {
      anchorIndexRef.current = -1;
      currentIndexRef.current = -1;
    },
  });

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
