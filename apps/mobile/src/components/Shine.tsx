import { type ReactNode, useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Animated, { type SharedValue, useAnimatedStyle, useDerivedValue } from 'react-native-reanimated';

// The band's width, as a share of what it sweeps across.
const BAND = 0.35;

type ShineProps = { progress: SharedValue<number> | null; children: ReactNode; highlight: ReactNode };

/**
 * A light band sweeping across `children` as `progress` goes 0 → 1 (useShineProgress; none while
 * null): `highlight` is the same content in the light color, shown through a window that moves
 * across it, so only the content lights up, never what is around it. Shines sharing one progress
 * sweep in step.
 */
export default function Shine({ progress, children, highlight }: ShineProps) {
  const [width, setWidth] = useState(0);

  function handleLayout(event: LayoutChangeEvent) {
    setWidth(event.nativeEvent.layout.width);
  }

  return (
    <View onLayout={handleLayout}>
      {children}
      {progress && width > 0 && (
        <Band progress={progress} width={width}>
          {highlight}
        </Band>
      )}
    </View>
  );
}

type BandProps = { progress: SharedValue<number>; width: number; children: ReactNode };

// The moving window over the highlight. It goes from past the right edge to past the left one; the
// highlight moves the other way, so it stays over the content.
function Band({ progress, width, children }: BandProps) {
  const band = width * BAND;
  const x = useDerivedValue(() => width - progress.value * (width + band));
  const windowStyle = useAnimatedStyle(() => ({ width: band, transform: [{ translateX: x.value }] }));
  const highlightStyle = useAnimatedStyle(() => ({ width, transform: [{ translateX: -x.value }] }));

  return (
    <Animated.View
      style={[styles.window, windowStyle]}
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      aria-hidden
    >
      <Animated.View style={highlightStyle}>{children}</Animated.View>
    </Animated.View>
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
