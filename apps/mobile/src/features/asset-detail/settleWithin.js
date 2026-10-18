import { clamp, withDecay, withSpring } from 'react-native-reanimated';

import { motion } from '@/styles/designTokens';

// Read in the body, not as a default parameter: a worklet captures what its body reads, not what a
// default parameter does.
const DEFAULT_SPRING = motion.spring;

/**
 * Lets `value` (a shared value) go at `velocity` within [min, max], as an iOS scroll view does: a
 * fling glides on and stops at the edge (rubber-banding past it); released past an edge, or with no
 * room at all, it springs back (`spring`, motion.spring by default). `onDone` is the animation's
 * callback.
 */
export default function settleWithin({ value, velocity, min, max, spring, onDone }) {
  'worklet';
  const isPastEdge = value.value < min || value.value > max || min === max;
  value.value = isPastEdge
    ? withSpring(clamp(value.value, min, max), { ...(spring ?? DEFAULT_SPRING), velocity }, onDone)
    : withDecay({ velocity, clamp: [min, max], rubberBandEffect: true }, onDone);
}
