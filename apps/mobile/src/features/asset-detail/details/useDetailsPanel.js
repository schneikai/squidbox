import { useCallback, useMemo, useState } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import {
  cancelAnimation,
  clamp,
  runOnJS,
  useAnimatedKeyboard,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import dragWithin from '@/features/asset-detail/dragWithin';
import settleWithin from '@/features/asset-detail/settleWithin';
import { motion } from '@/styles/designTokens';

// The page's share the open panel takes; the photo covers the rest, above it.
const OPEN_SHARE = 2 / 3;
// A release faster than this (points per second) is a flick, which settles with motion.spring's
// bounce; a slower one (or a tap) settles without.
const FLICK_VELOCITY = 300;
// Where a release at v points per second comes to rest at iOS's normal deceleration (withDecay's
// default, 0.998 per ms): v × d / (1 − d) / 1000.
const DECELERATION = 0.998;
const PROJECTION = DECELERATION / (1 - DECELERATION) / 1000;
// Room left between the note being edited and the keyboard.
const KEYBOARD_GAP = 16;

function springFor(velocity) {
  'worklet';
  return Math.abs(velocity) > FLICK_VELOCITY ? motion.spring : motion.settle;
}

/**
 * The asset screen's details panel, Apple Photos style: one track shared by every page of the
 * pager, each showing its photo and its own details (AssetPage). `offset` (points) is 0 closed,
 * `openAt` (OPEN_SHARE of the page) open, and past that the current page's details scrolled within
 * the panel, up to `maxAt`, their end (from the `contentHeight` the current page reports). Drags
 * (the photo's, through `verticalDrag` in useZoomGesture, and the panel's own, useDetailsPanelDrag)
 * move it rubber-banded past either end and release it as a scroll view would: within the details
 * it glides (stopping at their top), otherwise it settles open or closed by where the release
 * would carry it.
 *
 * `panel` goes to the pager (`pagerGesture` on its list) and its pages. The screen puts
 * `onPageLayout` and `liftStyle` on the view around the pager: while the current page's note is
 * edited (`panel.setEditingBottom`), that lifts the page just enough to show the field above the
 * keyboard. `isShown` is true from a drag's start until it has closed again. `open()` opens it,
 * `closeIfOpen()` closes it and says whether it was open, `reset()` closes it at once.
 */
export default function useDetailsPanel() {
  const [isShown, setIsShown] = useState(false);
  const offset = useSharedValue(0);
  const openAt = useSharedValue(0);
  const page = useSharedValue({ width: 0, height: 0 });
  const contentHeight = useSharedValue(0);
  const maxAt = useDerivedValue(() => Math.max(openAt.value, Math.round(contentHeight.value)));
  const editingBottom = useSharedValue(0);
  const isDragging = useSharedValue(false);
  // An animation is moving the panel, so a touch that lands on it catches it rather than taps.
  const isSettling = useSharedValue(false);
  // Where the running spring heads (-1 for a glide), so a touch that catches it can let it go on.
  const target = useSharedValue(-1);
  // A touch caught the moving panel and hasn't dragged it (yet).
  const isCaught = useSharedValue(false);
  // The list of pages: the vertical drags hold it while they run (useZoomGesture,
  // useDetailsPanelDrag), so a drag never pages.
  const pagerGesture = useMemo(() => Gesture.Native(), []);
  const keyboard = useAnimatedKeyboard();

  const settled = useCallback(
    (finished) => {
      'worklet';
      if (!finished) return;
      isSettling.value = false;
      if (offset.value <= 0) runOnJS(setIsShown)(false);
    },
    [isSettling, offset],
  );

  const settle = useCallback(
    (to, velocity = 0) => {
      'worklet';
      isSettling.value = true;
      target.value = to;
      offset.value = withSpring(to, { ...springFor(velocity), velocity }, settled);
    },
    [isSettling, target, offset, settled],
  );

  // Every stop of a running animation goes through here, so nothing is left settling.
  const stop = useCallback(() => {
    'worklet';
    cancelAnimation(offset);
    isSettling.value = false;
  }, [offset, isSettling]);

  // `velocity` in offset units: points per second, positive upwards.
  const release = useCallback(
    (velocity) => {
      'worklet';
      const open = openAt.value;
      if (offset.value > open) {
        isSettling.value = true;
        target.value = -1;
        settleWithin({
          value: offset,
          velocity,
          min: open,
          max: maxAt.value,
          spring: springFor(velocity),
          onDone: settled,
        });
        return;
      }
      const projected = offset.value + PROJECTION * velocity;
      settle(projected > open / 2 ? open : 0, velocity);
    },
    [openAt, maxAt, offset, isSettling, target, settle, settled],
  );

  // Details that got shorter (a row went away) pull a panel scrolled past their new end back.
  useAnimatedReaction(
    () => maxAt.value,
    (max, previous) => {
      if (previous === null || max >= previous || isDragging.value || offset.value <= max) return;
      settle(max);
    },
  );

  const verticalDrag = useMemo(
    () => ({
      isOpen: () => {
        'worklet';
        return offset.value > 0;
      },
      // While closed only a swipe up starts it: a swipe down stays with the sheet the screen may be
      // in (the create-post sheet), which the screen locks while the panel shows.
      canStart: (dy) => {
        'worklet';
        return offset.value > 0 || (dy < 0 && openAt.value > 0);
      },
      // A touch landing on the moving panel stops it; says whether it was moving.
      grab: () => {
        'worklet';
        const wasSettling = isSettling.value;
        stop();
        isCaught.value = wasSettling;
        return wasSettling;
      },
      // A touch that caught the panel and never dragged it lets it go on where it was heading.
      letGo: () => {
        'worklet';
        if (!isCaught.value) return;
        isCaught.value = false;
        if (target.value >= 0) settle(target.value);
        else release(0);
      },
      onStart: () => {
        'worklet';
        stop();
        isCaught.value = false;
        isDragging.value = true;
        runOnJS(setIsShown)(true);
      },
      onChange: (changeY) => {
        'worklet';
        offset.value = dragWithin({
          position: offset.value,
          delta: -changeY,
          min: 0,
          max: maxAt.value,
          dimension: page.value.height,
        });
      },
      onEnd: (velocityY) => {
        'worklet';
        isDragging.value = false;
        release(-velocityY);
      },
    }),
    [offset, openAt, maxAt, page, isSettling, isDragging, isCaught, target, stop, settle, release],
  );

  // The current page's details start at their top: another page's scroll doesn't carry over.
  const showFromTop = useCallback(() => {
    if (isDragging.value || offset.value <= openAt.value) return;
    stop();
    offset.value = openAt.value;
  }, [isDragging, offset, openAt, stop]);

  // Editing the note shows it at the top of the open panel, where the lift below expects it.
  const setEditingBottom = useCallback(
    (bottom) => {
      editingBottom.value = bottom;
      if (bottom > 0 && offset.value !== openAt.value) settle(openAt.value);
    },
    [editingBottom, offset, openAt, settle],
  );

  const open = useCallback(() => {
    if (openAt.value <= 0) return;
    setIsShown(true);
    settle(openAt.value);
  }, [openAt, settle]);

  const closeIfOpen = useCallback(() => {
    if (offset.value <= 0) return false;
    settle(0);
    return true;
  }, [offset, settle]);

  const reset = useCallback(() => {
    stop();
    offset.value = 0;
    setIsShown(false);
  }, [offset, stop]);

  const onPageLayout = useCallback(
    (event) => {
      const { width, height } = event.nativeEvent.layout;
      page.value = { width, height };
      openAt.value = Math.round(height * OPEN_SHARE);
    },
    [page, openAt],
  );

  // By how much the keyboard would cover the note (the room below it in the open panel is
  // `openAt − editingBottom`), never past the panel's top reaching the screen's.
  const liftStyle = useAnimatedStyle(() => {
    if (editingBottom.value <= 0) return { transform: [{ translateY: 0 }] };
    const overlap = keyboard.height.value + KEYBOARD_GAP - (openAt.value - editingBottom.value);
    return { transform: [{ translateY: -clamp(overlap, 0, page.value.height - openAt.value) }] };
  });

  const panel = useMemo(
    () => ({ offset, openAt, page, contentHeight, verticalDrag, pagerGesture, showFromTop, setEditingBottom }),
    [offset, openAt, page, contentHeight, verticalDrag, pagerGesture, showFromTop, setEditingBottom],
  );

  return { isShown, panel, open, closeIfOpen, reset, liftStyle, onPageLayout };
}
