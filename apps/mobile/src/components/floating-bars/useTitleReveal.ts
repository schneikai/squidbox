import { useEffect, useState } from 'react';
import {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { motion } from '@/styles/designTokens';

// A header's small title, shown once a larger title in the page is gone: from the offset `from` of
// the list's `scrollY` on, it fades and grows in over REVEAL_DISTANCE.
export type TitleReveal = { scrollY: SharedValue<number>; from: number };

const REVEAL_DISTANCE = 24; // pt of scrolling

/**
 * A header's title pill (ToolbarTitle): revealed by scrolling when `reveal` is given, always shown
 * otherwise, and moved out to the left in select mode. `isMounted` is false while a scroll-revealed
 * pill can't be seen, so its blur isn't drawn and it isn't a second copy of the page's title.
 */
export default function useTitleReveal(reveal: TitleReveal | undefined, isSelectMode: boolean) {
  const scrollY = reveal?.scrollY;
  const from = reveal?.from ?? 0;
  const [isMounted, setIsMounted] = useState(!reveal);

  // Select mode animates once per change, not on every scroll frame.
  const selectProgress = useSharedValue(isSelectMode ? 1 : 0);
  useEffect(() => {
    selectProgress.value = withTiming(isSelectMode ? 1 : 0, motion.move);
  }, [isSelectMode, selectProgress]);

  useAnimatedReaction(
    () => !scrollY || scrollY.value > from,
    (shown, previous) => {
      if (shown !== previous) scheduleOnRN(setIsMounted, shown);
    },
  );

  const style = useAnimatedStyle(() => {
    const progress = scrollY
      ? interpolate(scrollY.value, [from, from + REVEAL_DISTANCE], [0, 1], Extrapolation.CLAMP)
      : 1;
    return {
      opacity: progress * (1 - selectProgress.value),
      transform: [{ translateX: -24 * selectProgress.value }, { scale: interpolate(progress, [0, 1], [0.9, 1]) }],
    };
  });

  return { style, isMounted };
}
