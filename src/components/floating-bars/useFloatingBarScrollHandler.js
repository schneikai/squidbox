import { useAnimatedScrollHandler, withTiming } from 'react-native-reanimated';

import { useFloatingBars } from './FloatingBarsContext';

const DIRECTION_THRESHOLD = 6;
const TOP_REVEAL_Y = 24;

export default function useFloatingBarScrollHandler() {
  const { scrollY, isNavBarHidden } = useFloatingBars();

  return useAnimatedScrollHandler({
    onBeginDrag: (event, ctx) => {
      ctx.prevY = event.contentOffset.y;
      ctx.isDragging = true;
    },

    onScroll: (event, ctx) => {
      const y = event.contentOffset.y;
      scrollY.value = y;

      // Always reveal near the top regardless of direction
      if (y <= TOP_REVEAL_Y) {
        isNavBarHidden.value = withTiming(0, { duration: 160 });
        return;
      }

      // Only make hide/show decisions while the finger is actively dragging.
      // Momentum and bounce cause position reversals that are not intentional gestures.
      if (!ctx.isDragging) return;

      const dy = y - (ctx.prevY ?? y);
      if (dy > DIRECTION_THRESHOLD) {
        isNavBarHidden.value = withTiming(1, { duration: 160 });
      } else if (dy < -DIRECTION_THRESHOLD) {
        isNavBarHidden.value = withTiming(0, { duration: 160 });
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
}
