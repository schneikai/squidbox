import Animated, { Extrapolation, interpolate, useAnimatedProps, useDerivedValue } from 'react-native-reanimated';
import { Circle, Path } from 'react-native-svg';

import parts from './octopusParts.json';

import { colors, motion } from '@/styles/designTokens';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);

const COLORS = { fill: colors.background.splash, edge: '#8EDDF0', shine: '#FFFFFF' };
const FILL_OPACITY = 0.35;
const FAST = motion.duration.fast;
const [MOUTH_X, MOUTH_Y] = parts.mouthCenter;
const POP_Y = -40; // just above the top of the head
const RISE = MOUTH_Y - POP_Y;
// Progress points of the rise: it fades in, then wobbles from side to side (in drifts) as it grows.
const AT = [0, 0.08, 0.35, 0.7, 1];
const WOBBLE = [0, 0.3, -1, 1, -0.4];
const GROWTH = [0.4, 0.592, 1, 1, 1];
const POP_MS = FAST; // the bubble swells and vanishes
const DROPS = 6;
const HIDDEN = { x: 0, y: 0, cx: 0, cy: 0, r: 0, strokeWidth: 0, opacity: 0, drops: 1 };

// How long a bubble lasts once it pops: its droplets fly out and keep rising.
export const BUBBLE_POPPED_MS = 2 * FAST;

// One bubble, `since` ms after the octopus blew it: after `delay` it rises from the mouth over
// `duration` and pops just above the head.
export default function OctopusBubble({ radius, delay, drift, duration, since }) {
  const state = useDerivedValue(() => {
    const elapsed = since.value - delay;
    const sincePop = elapsed - duration;
    if (elapsed <= 0 || sincePop >= BUBBLE_POPPED_MS) return HIDDEN;
    const p = motion.shoot.easing(Math.min(1, elapsed / duration)); // still rising when it pops
    const pop = sincePop > 0 ? motion.enter.easing(Math.min(1, sincePop / POP_MS)) : 0;
    const x = MOUTH_X + drift * interpolate(p, AT, WOBBLE);
    const y = MOUTH_Y - RISE * p;
    const scale = interpolate(p, AT, GROWTH) * (1 + 0.5 * pop);
    return {
      x,
      y,
      cx: x,
      cy: y - 10 * pop,
      r: radius * scale,
      strokeWidth: 3 * scale,
      opacity: interpolate(p, [0, AT[1]], [0, 1], Extrapolation.CLAMP) * (1 - pop),
      drops: sincePop > 0 ? motion.enter.easing(sincePop / BUBBLE_POPPED_MS) : 1,
    };
  });

  const bubbleProps = useAnimatedProps(() => {
    const { cx, cy, r, strokeWidth, opacity } = state.value;
    return { cx, cy, r, strokeWidth, opacity };
  });
  const shineProps = useAnimatedProps(() => {
    const { cx, cy, r, opacity } = state.value;
    return { cx: cx - 0.35 * r, cy: cy - 0.35 * r, r: 0.28 * r, opacity };
  });
  const dropsProps = useAnimatedProps(() => {
    const { x, y, drops } = state.value;
    const r = Math.max(2, radius * 0.18);
    const out = radius * (1 + 0.9 * drops);
    let d = '';
    for (let i = 0; i < DROPS; i++) {
      const angle = (i / DROPS) * 2 * Math.PI + 0.3;
      const cx = x + Math.cos(angle) * out;
      const cy = y + Math.sin(angle) * out - 16 * drops;
      d += `M${cx - r},${cy}a${r},${r} 0 1,0 ${2 * r},0a${r},${r} 0 1,0 ${-2 * r},0`;
    }
    return { d, opacity: 1 - drops };
  });

  return (
    <>
      <AnimatedCircle animatedProps={bubbleProps} fill={COLORS.fill} fillOpacity={FILL_OPACITY} stroke={COLORS.edge} />
      <AnimatedCircle animatedProps={shineProps} fill={COLORS.shine} />
      <AnimatedPath animatedProps={dropsProps} fill={COLORS.edge} />
    </>
  );
}
