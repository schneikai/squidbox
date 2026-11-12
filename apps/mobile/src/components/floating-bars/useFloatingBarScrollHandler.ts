import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { useAnimatedScrollHandler, useSharedValue, withTiming } from 'react-native-reanimated';

import { useFloatingBars } from './FloatingBarsContext';

import { motion } from '@/styles/designTokens';

const DIRECTION_THRESHOLD = 6;
const TOP_REVEAL_Y = 24;

// The floating bars' scroll handler for a main tab's list. Every tab stays mounted and the bars share one
// `scrollY`, so only the focused tab writes it, and a tab coming into focus puts back its own offset: a
// tab left scrolled down (or still gliding) must not hide the title of the one shown.
export default function useFloatingBarScrollHandler() {
  const { scrollY, isNavBarHidden } = useFloatingBars();
  const ownY = useSharedValue(0);
  const isFocused = useSharedValue(false);

  useFocusEffect(
    useCallback(() => {
      isFocused.value = true;
      scrollY.value = ownY.value;
      isNavBarHidden.value = withTiming(0, motion.enter);
      return () => {
        isFocused.value = false;
      };
    }, [isFocused, scrollY, ownY, isNavBarHidden]),
  );

  return useAnimatedScrollHandler<{ prevY?: number; isDragging?: boolean }>({
    onBeginDrag: (event, ctx) => {
      ctx.prevY = event.contentOffset.y;
      ctx.isDragging = true;
    },

    onScroll: (event, ctx) => {
      const y = event.contentOffset.y;
      ownY.value = y;
      if (!isFocused.value) return;
      scrollY.value = y;

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
      ownY.value = event.contentOffset.y;
      if (isFocused.value) scrollY.value = event.contentOffset.y;
      ctx.isDragging = false;
    },
  });
}
