import { useNavigationState, useNavigation } from '@react-navigation/native';
import { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, interpolate } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useFloatingBars } from './FloatingBarsContext';
import FloatingPill from './FloatingPill';
import { getActiveTabName, isDetailScreenActive } from './navStateHelpers';

import GradientButton from '@/components/GradientButton';
import Icon from '@/components/Icon';
import actionButtonStyles from '@/styles/actionButtonStyles';
import { colors, spacing } from '@/styles/designTokens';

const NAV_ITEMS = [
  { tab: 'AssetsTab', icon: 'grid' },
  { tab: 'AlbumsTab', icon: 'folder' },
  { tab: 'PostsTab', icon: 'share-alt' },
];

const MAIN_TABS = NAV_ITEMS.map((item) => item.tab);

export default function FloatingNavigationBar() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { isNavBarHidden, isSearchActive, isSelectMode, resetScroll } = useFloatingBars();

  const activeTab = useNavigationState((s) => getActiveTabName(s));
  const isDetailActive = useNavigationState((s) => isDetailScreenActive(s));
  const isMainScreen = !isDetailActive && MAIN_TABS.includes(activeTab);

  const hideBar = isSearchActive || !isMainScreen || isSelectMode;

  // Toggle-driven: search / select / depth — animated both ways via shared value
  const contextHidden = useSharedValue(hideBar ? 1 : 0);
  useEffect(() => {
    contextHidden.value = withTiming(hideBar ? 1 : 0, { duration: 250 });
  }, [hideBar]);

  const navBarStyle = useAnimatedStyle(() => {
    // Scroll-driven: isNavBarHidden is already animated at the source (scroll handler)
    const scrollTranslate = interpolate(isNavBarHidden.value, [0, 1], [0, 100]);
    const scrollOpacity = interpolate(isNavBarHidden.value, [0, 1], [1, 0]);
    // Toggle-driven: search / select / depth
    const contextTranslate = interpolate(contextHidden.value, [0, 1], [0, 100]);
    const contextOpacity = interpolate(contextHidden.value, [0, 1], [1, 0]);
    // Most-hidden value wins
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
        {NAV_ITEMS.map(({ tab, icon }) => {
          const isActive = activeTab === tab;
          return <NavButton key={tab} icon={icon} isActive={isActive} onPress={() => handleNavigate(tab)} />;
        })}
      </FloatingPill>
    </Animated.View>
  );
}

function NavButton({ icon, isActive, onPress }) {
  if (isActive) {
    return (
      <GradientButton onPress={onPress}>
        <Icon name={icon} color={colors.iconActive} />
      </GradientButton>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [actionButtonStyles.pillButton, pressed && { backgroundColor: colors.pressedBg }]}
    >
      <Icon name={icon} color={colors.iconInactive} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: 100,
  },
});
