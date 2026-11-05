import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, interpolate, Extrapolation, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import SegmentedPill, { type SegmentedPillProps } from './SegmentedPill';

import { layout } from '@/styles/designTokens';

export type FloatingSegmentPillProps<Key extends string> = {
  tabs: SegmentedPillProps<Key>['items'];
  activeTab: SegmentedPillProps<Key>['activeKey'];
  onTabPress: SegmentedPillProps<Key>['onSelect'];
  expandProgress: SharedValue<number>;
};

/**
 * The bottom-right pill that switches between a screen's views. `tabs` are `{ key, icon, label }`; it
 * slides out while the search bar next to it is open (`expandProgress`, see SearchOptionsBar).
 */
export default function FloatingSegmentPill<Key extends string>({
  tabs,
  activeTab,
  onTabPress,
  expandProgress,
}: FloatingSegmentPillProps<Key>) {
  const insets = useSafeAreaInsets();

  const slideStyle = useAnimatedStyle(() => ({
    opacity: interpolate(expandProgress.value, [0, 0.5], [1, 0], Extrapolation.CLAMP),
    transform: [{ translateX: interpolate(expandProgress.value, [0, 1], [0, 30], Extrapolation.CLAMP) }],
    pointerEvents: expandProgress.value > 0.3 ? 'none' : 'auto',
  }));

  return (
    <Animated.View
      style={[styles.container, { bottom: insets.bottom + layout.barBottom }, slideStyle]}
      pointerEvents="box-none"
    >
      <SegmentedPill items={tabs} activeKey={activeTab} onSelect={onTabPress} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: layout.sideGutter,
    zIndex: 100,
  },
});
