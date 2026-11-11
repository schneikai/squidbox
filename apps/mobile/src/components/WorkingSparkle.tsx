import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import Icon from '@/components/Icon';
import Shine from '@/components/Shine';
import useBreath from '@/hooks/useBreath';
import useReduceMotion from '@/hooks/useReduceMotion';
import { colors, motion, sizes } from '@/styles/designTokens';

// A four-pointed star, in a 10 × 10 box.
const STAR = 'M5 0L6 4L10 5L6 6L5 10L4 6L0 5L4 4Z';

// The stars around an 18 pt sparkle, as the design has them: their size and their distance from two
// edges of its box, uneven so they never look placed. Scaled to the sparkle.
const DESIGN_SIZE = 18;
type StarPlace = { size: number; edgeY: 'top' | 'bottom'; y: number; edgeX: 'left' | 'right'; x: number };
const STARS: readonly StarPlace[] = [
  { size: 5, edgeY: 'top', y: 1, edgeX: 'left', x: 1 },
  { size: 4, edgeY: 'top', y: 0, edgeX: 'right', x: 0 },
  { size: 4, edgeY: 'bottom', y: 4, edgeX: 'right', x: 1 },
  { size: 4, edgeY: 'bottom', y: 1, edgeX: 'left', x: 0 },
];

// Where a star's pop is in its period: in by RISE, out from HOLD, gone from FALL.
const RISE = 0.25;
const HOLD = 0.32;
const FALL = 0.55;

type WorkingSparkleProps = { size?: number; shine: SharedValue<number> | null };

/**
 * The assistant's sparkle at work (an AssistantTray writing ideas): it breathes (motion.pulse), a
 * light band sweeps across it (Shine, on `shine`, the tray title's progress, so the two go in step) and four little stars around it
 * pop in and out, each on its own period (motion.working). The still sparkle with Reduce Motion.
 */
export default function WorkingSparkle({ size = sizes.menuIcon, shine }: WorkingSparkleProps) {
  const reduceMotion = useReduceMotion();
  const breath = useBreath();

  const breathStyle = useAnimatedStyle(() => ({
    opacity: interpolate(breath.value, [0, 1], [0.45, 1]),
    transform: [{ scale: interpolate(breath.value, [0, 1], [0.92, 1.05]) }],
  }));

  const sparkle = <Icon name="sparkle" size={size} color={colors.accent.base} />;
  const ratio = size / DESIGN_SIZE;

  if (reduceMotion) return sparkle;

  return (
    <View
      style={{ width: size, height: size }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.View style={breathStyle}>
        <Shine progress={shine} highlight={<Icon name="sparkle" size={size} color={colors.accent.shine} />}>
          {sparkle}
        </Shine>
      </Animated.View>
      {STARS.map((star, index) => (
        <Star key={index} index={index} ratio={ratio} {...star} />
      ))}
    </View>
  );
}

type StarProps = StarPlace & { index: number; ratio: number };

// One star, popping in and out on its own period and delay (motion.working.stars[index]).
function Star({ index, ratio, size, edgeY, y, edgeX, x }: StarProps) {
  const pop = useSharedValue(0);

  useEffect(() => {
    const { duration, delay } = motion.working.stars[index]!;
    const step = (to: number, share: number) =>
      withTiming(to, { duration: duration * share, easing: motion.pulse.easing });
    pop.value = withDelay(
      delay,
      withRepeat(withSequence(step(1, RISE), step(1, HOLD - RISE), step(0, FALL - HOLD), step(0, 1 - FALL)), -1),
    );
    return () => cancelAnimation(pop);
  }, [index, pop]);

  const popStyle = useAnimatedStyle(() => ({
    opacity: pop.value,
    transform: [{ scale: interpolate(pop.value, [0, 1], [0.3, 1]) }],
  }));

  const side = size * ratio;
  const position = { [edgeY]: y * ratio, [edgeX]: x * ratio };
  return (
    <Animated.View style={[styles.star, { width: side, height: side }, position, popStyle]}>
      <Svg width={side} height={side} viewBox="0 0 10 10">
        <Path d={STAR} fill={colors.accent.spark} />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  star: {
    position: 'absolute',
  },
});
