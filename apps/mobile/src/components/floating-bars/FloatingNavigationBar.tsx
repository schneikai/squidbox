import { type Href, router } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, interpolate } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useFloatingBars } from './FloatingBarsContext';
import SegmentedPill, { type SegmentedPillItem } from './SegmentedPill';

import { layout, motion } from '@/styles/designTokens';

// Keyed by the tab's route name (`app/(main)/(tabs)/`).
const NAV_ITEMS = [
  { key: 'index', href: '/', icon: 'image', label: 'Library' },
  { key: 'albums', href: '/albums', icon: 'images', label: 'Albums' },
  { key: 'contacts', href: '/contacts', icon: 'contacts', label: 'Contacts' },
  { key: 'posts', href: '/posts', icon: 'send', label: 'Posts' },
] satisfies (SegmentedPillItem & { href: Href })[];

const HREFS = Object.fromEntries(NAV_ITEMS.map((item) => [item.key, item.href]));

// The main tabs' bar (the tab navigator's `tabBar`), floating over the tab. Settings has none.
export default function FloatingNavigationBar({ state }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { isSearchActive, isSelectMode } = useFloatingBars();

  const activeTab = state.routes[state.index].name;
  const hideBar = isSearchActive || activeTab === 'settings' || isSelectMode;

  // Hidden only while search or select mode is on, and on Settings: never on scroll, so people always
  // see which tab they're in (HIG, Tab bars).
  const contextHidden = useSharedValue(hideBar ? 1 : 0);
  useEffect(() => {
    contextHidden.value = withTiming(hideBar ? 1 : 0, hideBar ? motion.exit : motion.enter);
  }, [hideBar]);

  const navBarStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: interpolate(contextHidden.value, [0, 1], [0, 100]) }],
      opacity: interpolate(contextHidden.value, [0, 1], [1, 0]),
    };
  });

  function handleNavigate(tab: string) {
    router.navigate(HREFS[tab]);
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          bottom: insets.bottom + layout.barMargin,
          right: layout.sideGutter,
        },
        navBarStyle,
      ]}
    >
      <SegmentedPill items={NAV_ITEMS} activeKey={activeTab} onSelect={handleNavigate} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: 100,
  },
});
