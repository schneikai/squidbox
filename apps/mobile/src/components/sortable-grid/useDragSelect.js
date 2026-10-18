import { useNavigation } from '@react-navigation/native';
import { useEffect, useMemo, useRef } from 'react';
import { Gesture } from 'react-native-gesture-handler';

import gridIndexAtPoint from './gridIndexAtPoint';
import useEdgeAutoScroll from './useEdgeAutoScroll';

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
// Near the top/bottom edge the list auto-scrolls (useEdgeAutoScroll). `layout`: the grid's cells,
// see gridSlotOrigin.

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
}) {
  const navigation = useNavigation();
  const haptics = useHaptics();

  // A drag can start in the grid's first column, where iOS's swipe-back gesture also starts. Turn
  // swipe-back off while drag-select is on, so the drag selects instead of leaving the screen.
  useEffect(() => {
    navigation.setOptions({ gestureEnabled: !enabled });
  }, [navigation, enabled]);

  const baseSelectedRef = useRef([]);
  const anchorIndexRef = useRef(-1);
  const currentIndexRef = useRef(-1);
  const intentRef = useRef(true); // true = add to selection, false = remove

  // The rows are read through the handlers (not the gesture's deps): a page loading mid-drag, e.g.
  // from the auto-scroll, must not rebuild the gesture. Indices past the loaded rows select nothing.
  const handlers = useRef({});
  handlers.current.rows = rows ?? [];

  handlers.current.indexAtPoint = (x, y) =>
    gridIndexAtPoint({
      x,
      y,
      scrollOffset: scrollY?.value ?? 0,
      paddingTop,
      layout,
      count: handlers.current.rows.length,
    });

  handlers.current.applyRange = (currentIndex) => {
    const anchor = anchorIndexRef.current;
    if (anchor === -1 || currentIndex === -1) return;

    const lo = Math.min(anchor, currentIndex);
    const hi = Math.max(anchor, currentIndex);
    const set = new Set(baseSelectedRef.current);
    for (let i = lo; i <= hi; i++) {
      const id = handlers.current.rows[i]?.id;
      if (!id) continue;
      if (intentRef.current) set.add(id);
      else set.delete(id);
    }
    onSelect([...set]);
  };

  handlers.current.updateFromPoint = (x, y) => {
    const index = handlers.current.indexAtPoint(x, y);
    if (index === -1 || index === currentIndexRef.current) return;
    currentIndexRef.current = index;
    handlers.current.applyRange(index);
  };

  const autoScroll = useEdgeAutoScroll({
    listRef,
    scrollY,
    onScrolled: (x, y) => handlers.current.updateFromPoint(x, y),
  });

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(enabled)
        .activateAfterLongPress(LONG_PRESS_MS)
        .runOnJS(true)
        .onStart((e) => {
          const index = handlers.current.indexAtPoint(e.x, e.y);
          if (index === -1) {
            anchorIndexRef.current = -1;
            return;
          }
          baseSelectedRef.current = selectedIdsRef.current ?? [];
          anchorIndexRef.current = index;
          currentIndexRef.current = index;
          intentRef.current = !baseSelectedRef.current.includes(handlers.current.rows[index].id);
          handlers.current.applyRange(index);
          haptics.selection();
          autoScroll.start(e.x, e.y);
        })
        .onUpdate((e) => {
          autoScroll.move(e.x, e.y);
          handlers.current.updateFromPoint(e.x, e.y);
        })
        .onFinalize(() => {
          autoScroll.stop();
          anchorIndexRef.current = -1;
          currentIndexRef.current = -1;
        }),
    [enabled, selectedIdsRef, onSelect, autoScroll, haptics],
  );

  return { gesture, onContainerLayout: autoScroll.onContainerLayout };
}
