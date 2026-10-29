import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { colors, motion, radii } from '@/styles/designTokens';

/** How far a run is (`progress`, 0 to 1): a track with an accent fill that moves to each new value. */
export default function ProgressBar({ progress, accessibilityLabel }) {
  const shown = useSharedValue(progress);

  useEffect(() => {
    shown.value = withTiming(progress, motion.move);
  }, [progress, shown]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${Math.min(1, Math.max(0, shown.value)) * 100}%` }));

  return (
    <View
      style={styles.track}
      role="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
    >
      <Animated.View style={[styles.fill, fillStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.border.glass,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radii.pill,
    backgroundColor: colors.accent.base,
  },
});
