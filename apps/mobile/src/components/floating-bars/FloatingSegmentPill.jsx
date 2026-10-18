import { Pressable, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, interpolate, Extrapolation } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import FloatingPill from './FloatingPill';

import GradientButton from '@/components/GradientButton';
import Icon from '@/components/Icon';
import actionButtonStyles from '@/styles/actionButtonStyles';
import { colors, spacing } from '@/styles/designTokens';

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
      <FloatingPill>
        {tabs.map((tab) => (
          <SegmentButton key={tab.key} tab={tab} isActive={activeTab === tab.key} onPress={() => onTabPress(tab.key)} />
        ))}
      </FloatingPill>
    </Animated.View>
  );
}

function SegmentButton({ tab, isActive, onPress }) {
  if (isActive) {
    return (
      <GradientButton onPress={onPress} accessibilityLabel={tab.label}>
        <Icon name={tab.icon} color={colors.iconActive} />
      </GradientButton>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={tab.label}
      style={({ pressed }) => [actionButtonStyles.pillButton, pressed && { backgroundColor: colors.pressedBg }]}
    >
      <Icon name={tab.icon} color={colors.iconInactive} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: spacing.floatingBarSide,
    zIndex: 100,
  },
});
