import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { useAnimatedScrollHandler, useSharedValue, withTiming } from 'react-native-reanimated';

import { useFloatingBars } from './FloatingBarsContext';

import { motion } from '@/styles/designTokens';

const DIRECTION_THRESHOLD = 6;
const TOP_REVEAL_Y = 24;

// A main tab's list scrolling: `onScroll` for the list, and `scrollY`, this tab's own offset, for its
// FloatingHeader. Every tab stays mounted, so each keeps its own offset, and only the focused tab moves
// the navigation bar, which all tabs share.
export default function useFloatingBarScrollHandler() {
  const { isNavBarHidden } = useFloatingBars();
  const scrollY = useSharedValue(0);
  const isFocused = useSharedValue(false);

  useFocusEffect(
    useCallback(() => {
      isFocused.value = true;
      isNavBarHidden.value = withTiming(0, motion.enter);
      return () => {
        isFocused.value = false;
      };
    }, [isFocused, isNavBarHidden]),
  );

  const onScroll = useAnimatedScrollHandler<{ prevY?: number; isDragging?: boolean }>({
    onBeginDrag: (event, ctx) => {
      ctx.prevY = event.contentOffset.y;
      ctx.isDragging = true;
    },

    onScroll: (event, ctx) => {
      const y = event.contentOffset.y;
      scrollY.value = y;
      if (!isFocused.value) return;

      // Always reveal near the top regardless of direction
      if (y <= TOP_REVEAL_Y) {
        isNavBarHidden.value = withTiming(0, motion.enter);
        return;
      }

      // Only make hide/show decisions while the finger is actively dragging.
      // Momentum and bounce cause position reversals that are not intentional gestures.
      if (!ctx.isDragging) return;

      const dy = y - (ctx.prevY ?? y);
      if (dy > DIRECTION_THRESHOLD) {
        isNavBarHidden.value = withTiming(1, motion.exit);
      } else if (dy < -DIRECTION_THRESHOLD) {
        isNavBarHidden.value = withTiming(0, motion.enter);
      }
      ctx.prevY = y;
    },

    onEndDrag: (event, ctx) => {
      ctx.prevY = event.contentOffset.y;
      ctx.isDragging = false;
    },

    onMomentumBegin: (event, ctx) => {
      ctx.prevY = event.contentOffset.y;
      ctx.isDragging = false;
    },

    onMomentumEnd: (event, ctx) => {
      scrollY.value = event.contentOffset.y;
      ctx.isDragging = false;
    },
  });

  return { onScroll, scrollY };
}
