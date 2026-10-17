import { useCallback, useMemo, useState } from 'react';
import { cancelAnimation, clamp, runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import getDetailsMediaShift from './getDetailsMediaShift';

import { motion } from '@/styles/designTokens';

// The panel's share of the page.
const HEIGHT_SHARE = 0.5;
// A release faster than this (points per second) settles the way it moves.
const FLING_VELOCITY = 500;

/**
 * The asset screen's details panel, Apple Photos style: `verticalDrag` (for useZoomGesture) slides
 * the photo (`mediaStyle`, on the view around the pager, which reports `onMediaLayout`) up and the
 * panel (`panelStyle`) in below it, following the finger and settling open or closed. `isShown` is
 * true from the drag's start until it has closed again. `closeIfOpen()` closes it and says whether it
 * was open; `reset()` closes it at once.
 */
export default function useDetailsPanel({ aspectRatio, headerBottom }) {
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 });
  // 0 closed, 1 open; a settling spring overshoots both, which the styles clamp.
  const progress = useSharedValue(0);
  const [isShown, setIsShown] = useState(false);

  const height = Math.round(pageSize.height * HEIGHT_SHARE);
  const shift = getDetailsMediaShift({ ...pageSize, aspectRatio, panelHeight: height, headerBottom });

  // A spring that settles closed hides the panel, unless a new drag caught it.
  const hideOnceClosed = useCallback((finished) => {
    'worklet';
    if (finished) runOnJS(setIsShown)(false);
  }, []);

  const verticalDrag = useMemo(
    () => ({
      isOpen: () => {
        'worklet';
        return progress.value > 0;
      },
      // While closed only a swipe up starts it: a swipe down stays with the sheet the screen may be in
      // (the create-post sheet), which the screen locks while the panel shows.
      canStart: (dy) => {
        'worklet';
        return dy < 0 || progress.value > 0;
      },
      onStart: () => {
        'worklet';
        runOnJS(setIsShown)(true);
      },
      onChange: (changeY) => {
        'worklet';
        if (height > 0) progress.value = clamp(progress.value - changeY / height, 0, 1);
      },
      onEnd: (velocityY) => {
        'worklet';
        const opens = Math.abs(velocityY) > FLING_VELOCITY ? velocityY < 0 : progress.value >= 0.5;
        const config = { ...motion.spring, velocity: height > 0 ? -velocityY / height : 0 };
        progress.value = withSpring(opens ? 1 : 0, config, opens ? undefined : hideOnceClosed);
      },
    }),
    [progress, height, hideOnceClosed],
  );

  const closeIfOpen = useCallback(() => {
    if (progress.value <= 0) return false;
    progress.value = withSpring(0, motion.spring, hideOnceClosed);
    return true;
  }, [progress, hideOnceClosed]);

  const reset = useCallback(() => {
    cancelAnimation(progress);
    progress.value = 0;
    setIsShown(false);
  }, [progress]);

  const onMediaLayout = useCallback((event) => {
    const { width, height: pageHeight } = event.nativeEvent.layout;
    setPageSize({ width, height: pageHeight });
  }, []);

  const mediaStyle = useAnimatedStyle(
    () => ({ transform: [{ translateY: -clamp(progress.value, 0, 1) * shift }] }),
    [shift],
  );
  const panelStyle = useAnimatedStyle(
    () => ({ height, transform: [{ translateY: (1 - clamp(progress.value, 0, 1)) * height }] }),
    [height],
  );

  return { isShown, verticalDrag, closeIfOpen, reset, mediaStyle, panelStyle, onMediaLayout };
}
