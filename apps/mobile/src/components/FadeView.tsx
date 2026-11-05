import type { ViewProps } from 'react-native';
import Animated, { useAnimatedStyle, withDelay, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { motion } from '@/styles/designTokens';

// Far enough to the left to be off any screen; to the left so a browser adds no scroll area for it.
const OFFSCREEN_X = -100000;

export type FadeViewProps = Pick<ViewProps, 'style' | 'pointerEvents' | 'children'> & {
  isVisible: boolean;
  onHidden?: () => void;
};

/**
 * A view that fades in (`motion.enter`) and out (`motion.exit`) with `isVisible`. Faded out, it
 * moves off screen, where nothing in it can be tapped on any platform, and is hidden from
 * accessibility. A transform leaves its layout alone, so its children stay mounted and keep their
 * sizes. `pointerEvents` applies while it's shown; while hidden or fading out it takes no touches.
 * `onHidden` is called when it is off screen (faded out, or hidden from the start), for a parent
 * that drops its children then.
 */
export default function FadeView({ isVisible, style, pointerEvents, onHidden, children }: FadeViewProps) {
  const visibilityStyle = useAnimatedStyle(() => ({
    opacity: withTiming(isVisible ? 1 : 0, isVisible ? motion.enter : motion.exit),
    transform: [
      {
        translateX: isVisible
          ? 0
          : withDelay(
              motion.exit.duration,
              withTiming(OFFSCREEN_X, { duration: 0 }, (finished) => {
                if (finished && onHidden) scheduleOnRN(onHidden);
              }),
            ),
      },
    ],
  }));

  return (
    <Animated.View
      style={[style, visibilityStyle]}
      // A prop, not a style: Reanimated's web views drop `pointerEvents` given as a style.
      pointerEvents={isVisible ? pointerEvents : 'none'}
      aria-hidden={!isVisible}
    >
      {children}
    </Animated.View>
  );
}
