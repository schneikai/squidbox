import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, interpolate, Extrapolation } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import SegmentedPill from './SegmentedPill';

import { spacing } from '@/styles/designTokens';

/**
 * The bottom-right pill that switches between a screen's views. `tabs` are `{ key, icon, label }`; it
 * slides out while the search bar next to it is open (`expandProgress`, see SearchOptionsBar).
 */
export default function FloatingSegmentPill({ tabs, activeTab, onTabPress, expandProgress }) {
  const insets = useSafeAreaInsets();

  const slideStyle = useAnimatedStyle(() => ({
    opacity: interpolate(expandProgress.value, [0, 0.5], [1, 0], Extrapolation.CLAMP),
    transform: [{ translateX: interpolate(expandProgress.value, [0, 1], [0, 30], Extrapolation.CLAMP) }],
    pointerEvents: expandProgress.value > 0.3 ? 'none' : 'auto',
  }));

  return (
    <Animated.View
      style={[styles.container, { bottom: insets.bottom + spacing.floatingBarBottom }, slideStyle]}
      pointerEvents="box-none"
    >
      <SegmentedPill items={tabs} activeKey={activeTab} onSelect={onTabPress} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: spacing.floatingBarSide,
    zIndex: 100,
  },
});
