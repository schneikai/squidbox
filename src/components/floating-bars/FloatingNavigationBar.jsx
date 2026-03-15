import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet } from 'react-native';
import { useEffect } from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigationState, useNavigation } from '@react-navigation/native';

import GradientButton from '@/components/GradientButton';
import { useFloatingBars } from './FloatingBarsContext';
import { getActiveTabName, getActiveStackDepth } from './navStateHelpers';
import FloatingPill from './FloatingPill';
import actionButtonStyles from '@/styles/actionButtonStyles';
import { colors, spacing } from '@/styles/designTokens';

const NAV_ITEMS = [
  { tab: 'AssetsTab', icon: 'grid-outline', iconActive: 'grid' },
  { tab: 'AlbumsTab', icon: 'folder-outline', iconActive: 'folder' },
  { tab: 'PostsTab', icon: 'share-social-outline', iconActive: 'share-social' },
];

export default function FloatingNavigationBar() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { navScrollOffset, isSearchActive, isSelectMode, resetScroll } = useFloatingBars();

  const activeTab = useNavigationState((s) => getActiveTabName(s));
  const stackDepth = useNavigationState((s) => getActiveStackDepth(s));
  const isMainScreen = stackDepth === 0;

  const hideBar = isSearchActive || !isMainScreen || isSelectMode;

  // Animates 0 → 1 (hide) and 1 → 0 (show) so both directions get a smooth transition
  const contextHidden = useSharedValue(hideBar ? 1 : 0);
  useEffect(() => {
    contextHidden.value = withTiming(hideBar ? 1 : 0, { duration: 250 });
  }, [hideBar]);

  const navBarStyle = useAnimatedStyle(() => {
    // Scroll-driven: tracks accumulated downward scroll, resets via spring on scroll-up
    const scrollTranslate = interpolate(navScrollOffset.value, [20, 100], [0, 100], Extrapolation.CLAMP);
    const scrollOpacity = interpolate(navScrollOffset.value, [20, 100], [1, 0], Extrapolation.CLAMP);
    // Toggle-driven: animated shared value so both hide and show are smooth
    const contextTranslate = interpolate(contextHidden.value, [0, 1], [0, 100]);
    const contextOpacity = interpolate(contextHidden.value, [0, 1], [1, 0]);
    return {
      transform: [{ translateY: Math.max(scrollTranslate, contextTranslate) }],
      opacity: Math.min(scrollOpacity, contextOpacity),
    };
  });

  function handleNavigate(tab) {
    resetScroll();
    navigation.navigate('MainTab', { screen: tab });
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          bottom: insets.bottom + spacing.floatingBarBottom,
          right: spacing.floatingBarSide,
        },
        navBarStyle,
      ]}
    >
      <FloatingPill>
        {NAV_ITEMS.map(({ tab, icon, iconActive }) => {
          const isActive = activeTab === tab;
          return (
            <NavButton
              key={tab}
              icon={isActive ? iconActive : icon}
              isActive={isActive}
              onPress={() => handleNavigate(tab)}
            />
          );
        })}
      </FloatingPill>
    </Animated.View>
  );
}

function NavButton({ icon, isActive, onPress }) {
  if (isActive) {
    return (
      <GradientButton onPress={onPress}>
        <Ionicons name={icon} size={spacing.iconSize} color={colors.iconActive} />
      </GradientButton>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [actionButtonStyles.pillButton, pressed && { backgroundColor: colors.pressedBg }]}
    >
      <Ionicons name={icon} size={spacing.iconSize} color={colors.iconInactive} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: 100,
  },
});
