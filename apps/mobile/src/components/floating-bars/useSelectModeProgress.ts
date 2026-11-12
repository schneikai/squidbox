import { useEffect } from 'react';
import { useSharedValue, withTiming } from 'react-native-reanimated';

import { motion } from '@/styles/designTokens';

// 0 out of select mode, 1 in it, animated once per change: for the header pieces that move aside in
// select mode, so a style that also follows the scroll doesn't start a timing on every frame.
export default function useSelectModeProgress(isSelectMode: boolean) {
  const progress = useSharedValue(isSelectMode ? 1 : 0);
  useEffect(() => {
    progress.value = withTiming(isSelectMode ? 1 : 0, motion.move);
  }, [isSelectMode, progress]);
  return progress;
}
