import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  cancelAnimation,
  clamp,
  runOnJS,
  scrollTo,
  useAnimatedReaction,
  useEvent,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import shiftPager from './shiftPager';
import snapPagerShift from './snapPagerShift';

import { motion } from '@/styles/designTokens';

/**
 * The pager's side of a zoomed photo's edge swipe, Apple Photos style: once the zoomed pan
 * (useZoomGesture) has the image on its left or right edge and the finger keeps going, it hands the
 * rest of the movement to `edgeSwipe.drag(changeX)`, which scrolls the list (`listRef`, an animated
 * ref on an Animated.FlatList of `pageCount` pages `pageWidth` wide) along with the finger from page
 * `pageIndex`. It returns `leftover` (what the pager couldn't take, for the image), `hasMoved` (the
 * pager took some of it) and `isShifted` (the list is off its page afterwards).
 * `edgeSwipe.release(velocityX)` snaps it to the neighbouring page or back (snapPagerShift) and
 * reports a new page through `onPage(index)`, as a native swipe does. `isShifted()` says whether the list is off its page,
 * `stop()` catches a running snap where it is. All of them are worklets, for the pan's UI thread.
 *
 * `onListDragStart` goes on the list's `onScrollBeginDrag`: the list's own drag takes over from a
 * running snap. It subscribes to the drag start alone, not to every scroll frame.
 */
export default function usePagerEdgeSwipe({ listRef, pageWidth, pageIndex, pageCount, onPage }) {
  // Points from the current page's origin, positive towards the next page.
  const shift = useSharedValue(0);
  // What the UI thread needs of the props. A zoomed pan only starts on the current page at rest,
  // so the list sits on `index` whenever a hand-off begins.
  const pager = useSharedValue({ index: pageIndex, count: pageCount, width: pageWidth });
  // The next change of `shift` is a reset that must not scroll (the list's own drag has it).
  const isDetached = useSharedValue(false);
  const onPageRef = useRef(onPage);

  useEffect(() => {
    onPageRef.current = onPage;
  }, [onPage]);

  useEffect(() => {
    pager.value = { index: pageIndex, count: pageCount, width: pageWidth };
  }, [pager, pageIndex, pageCount, pageWidth]);

  // Stable for runOnJS, whatever `onPage` is now.
  const reportPage = useCallback((index) => onPageRef.current(index), []);

  useAnimatedReaction(
    () => shift.value,
    (value, previous) => {
      if (isDetached.value) {
        isDetached.value = false;
        return;
      }
      if (value === 0 && (previous === null || previous === 0)) return;
      const { index, count, width } = pager.value;
      // A fast release can still carry the snap's spring past its page: never past the neighbouring
      // pages (the only ones mounted around the current one) or the content's ends.
      const x = clamp(index * width + clamp(value, -width, width), 0, Math.max(count - 1, 0) * width);
      scrollTo(listRef, x, 0, false);
    },
  );

  const onListDragStart = useEvent(() => {
    'worklet';
    if (shift.value === 0) return;
    cancelAnimation(shift);
    isDetached.value = true;
    shift.value = 0;
  }, ['onScrollBeginDrag']);

  const edgeSwipe = useMemo(() => {
    const neighbours = () => {
      'worklet';
      const { index, count, width } = pager.value;
      return { pageWidth: width, hasPrevious: index > 0, hasNext: index < count - 1 };
    };

    const settled = (finished) => {
      'worklet';
      if (!finished || shift.value === 0) return;
      const delta = Math.sign(shift.value);
      const { index, count, width } = pager.value;
      // Same frame: the new page's origin is where the list already is, so it doesn't jump back.
      pager.value = { index: index + delta, count, width };
      shift.value = 0;
      runOnJS(reportPage)(index + delta);
    };

    return {
      isShifted: () => {
        'worklet';
        return shift.value !== 0;
      },
      stop: () => {
        'worklet';
        cancelAnimation(shift);
      },
      drag: (delta) => {
        'worklet';
        const previous = shift.value;
        const next = shiftPager({ shift: previous, delta, ...neighbours() });
        shift.value = next.shift;
        return { leftover: next.leftover, hasMoved: next.shift !== previous, isShifted: next.shift !== 0 };
      },
      release: (velocityX) => {
        'worklet';
        const velocity = -velocityX;
        const landing = snapPagerShift({ shift: shift.value, velocity, ...neighbours() });
        // Without a bounce, flick or not, as native paging snaps.
        shift.value = withSpring(landing * pager.value.width, { ...motion.settle, velocity }, settled);
      },
    };
  }, [shift, pager, reportPage]);

  return { edgeSwipe, onListDragStart };
}
