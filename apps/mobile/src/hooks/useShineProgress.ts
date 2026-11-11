import { useEffect } from 'react';
import { cancelAnimation, type SharedValue, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import useReduceMotion from '@/hooks/useReduceMotion';
import { motion } from '@/styles/designTokens';

/**
 * Where a Shine's band is in its sweep (motion.working.band), 0 → 1 on repeat while `isOn`, for every
 * Shine that sweeps in step (the tray's sparkle and title); null when off or with Reduce Motion, so
 * nothing shines.
 */
export default function useShineProgress(isOn: boolean): SharedValue<number> | null {
  const reduceMotion = useReduceMotion();
  const progress = useSharedValue(0);
  const isMoving = isOn && !reduceMotion;

  useEffect(() => {
    if (!isMoving) return;
    progress.value = 0;
    progress.value = withRepeat(withTiming(1, motion.working.band), -1);
    return () => cancelAnimation(progress);
  }, [isMoving, progress]);

  return isMoving ? progress : null;
}
