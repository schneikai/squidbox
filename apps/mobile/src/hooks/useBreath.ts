import { useEffect } from 'react';
import { cancelAnimation, type SharedValue, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import useReduceMotion from '@/hooks/useReduceMotion';
import { motion } from '@/styles/designTokens';

/**
 * A breath for what is at work (motion.pulse): a shared value going 0 → 1 → 0 on repeat, for the
 * caller's own animated style. Stays 0 with Reduce Motion.
 */
export default function useBreath(): SharedValue<number> {
  const reduceMotion = useReduceMotion();
  const breath = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    breath.value = withRepeat(withTiming(1, motion.pulse), -1, true);
    return () => cancelAnimation(breath);
  }, [reduceMotion, breath]);

  return breath;
}
