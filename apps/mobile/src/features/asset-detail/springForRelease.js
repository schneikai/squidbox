import { motion } from '@/styles/designTokens';

// A release faster than this (points per second) is a flick, which settles with motion.spring's
// bounce; a slower one (or a tap) settles without.
const FLICK_VELOCITY = 300;

/** The spring a release at `velocity` (points per second, either sign) settles with. */
export default function springForRelease(velocity) {
  'worklet';
  return Math.abs(velocity) > FLICK_VELOCITY ? motion.spring : motion.settle;
}
