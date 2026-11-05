import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { motion } from '@/styles/designTokens';

/**
 * A view that unfolds to its content's height (`motion.move`) with `isOpen`, clipping while it
 * moves, so what is below it moves with it; once open it lets its content lay itself out. It folds
 * shut the same way and then unmounts its children: nothing is rendered while shut, so what is
 * inside (and any hook in it) exists only while it's open or moving. Mounted open, it shows its
 * content at once.
 */
export default function FoldView({ isOpen, children }) {
  const [isMounted, setIsMounted] = useState(isOpen);
  // Unfolding waits for the content's first layout (its data may still be loading), so it moves the
  // whole way instead of jumping to a height measured part way through.
  const [isMeasured, setIsMeasured] = useState(isOpen);
  const progress = useSharedValue(isOpen ? 1 : 0);
  const contentHeight = useSharedValue(0);

  if (isOpen && !isMounted) setIsMounted(true);

  useEffect(() => {
    // A fold's end can land after the next change (a reopen right as it shut): then it does nothing.
    let isCurrent = true;
    function unmount() {
      if (!isCurrent) return;
      setIsMounted(false);
      setIsMeasured(false);
    }

    if (isOpen) {
      if (isMeasured) progress.value = withTiming(1, motion.move);
    } else if (progress.value === 0) {
      // Nothing showing (never unfolded, or folded before its content came): unmount at once.
      unmount();
    } else {
      progress.value = withTiming(0, motion.move, (finished) => {
        if (finished) scheduleOnRN(unmount);
      });
    }
    return () => {
      isCurrent = false;
    };
  }, [isOpen, isMeasured, progress]);

  // Open, 'auto' (set, not left out: a dropped key keeps its last value) and unclipped, so the
  // content's shadows show; moving, a fixed height that clips.
  const foldStyle = useAnimatedStyle(() =>
    progress.value === 1
      ? { height: 'auto', overflow: 'visible' }
      : { height: progress.value * contentHeight.value, overflow: 'hidden' },
  );

  function handleLayout(event) {
    const { height } = event.nativeEvent.layout;
    contentHeight.value = height;
    if (height > 0) setIsMeasured(true);
  }

  if (!isMounted) return null;

  return (
    <Animated.View style={foldStyle} aria-hidden={!isOpen}>
      <View onLayout={handleLayout}>{children}</View>
    </Animated.View>
  );
}
