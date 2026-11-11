import { type ReactNode, useEffect, useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import useReduceMotion from '@/hooks/useReduceMotion';
import { motion } from '@/styles/designTokens';

// The band's width, as a share of what it sweeps across.
const BAND = 0.35;

type ShineProps = { isOn: boolean; children: ReactNode; highlight: ReactNode };

/**
 * A light band sweeping across `children` while `isOn` (motion.working.band): `highlight` is the
 * same content in the light color, shown through a window that moves across it, so only the content
 * lights up, never what is around it. Still with Reduce Motion.
 */
export default function Shine({ isOn, children, highlight }: ShineProps) {
  const reduceMotion = useReduceMotion();
  const [width, setWidth] = useState(0);
  const progress = useSharedValue(0);
  const isMoving = isOn && !reduceMotion && width > 0;

  useEffect(() => {
    if (!isMoving) return;
    progress.value = 0;
    progress.value = withRepeat(withTiming(1, motion.working.band), -1);
    return () => cancelAnimation(progress);
  }, [isMoving, progress]);

  // The window goes from past the right edge to past the left one; the highlight moves the other
  // way, so it stays over the content.
  const windowStyle = useAnimatedStyle(() => {
    const band = width * BAND;
    const x = width - progress.value * (width + band);
    return { width: band, transform: [{ translateX: x }] };
  });
  const highlightStyle = useAnimatedStyle(() => {
    const band = width * BAND;
    return { width, transform: [{ translateX: -(width - progress.value * (width + band)) }] };
  });

  function handleLayout(event: LayoutChangeEvent) {
    setWidth(event.nativeEvent.layout.width);
  }

  return (
    <View onLayout={handleLayout}>
      {children}
      {isMoving && (
        <Animated.View
          style={[styles.window, windowStyle]}
          pointerEvents="none"
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
        >
          <Animated.View style={highlightStyle}>{highlight}</Animated.View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  window: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    overflow: 'hidden',
  },
});
