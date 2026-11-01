import { router } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, interpolate } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useFloatingBars } from './FloatingBarsContext';
import SegmentedPill from './SegmentedPill';

import { layout, motion } from '@/styles/designTokens';

// Keyed by the tab's route name (`app/(main)/(tabs)/`).
const NAV_ITEMS = [
  { key: 'index', href: '/', icon: 'grid', label: 'Library' },
  { key: 'albums', href: '/albums', icon: 'folder', label: 'Albums' },
  { key: 'posts', href: '/posts', icon: 'share-alt', label: 'Posts' },
];

const HREFS = Object.fromEntries(NAV_ITEMS.map((item) => [item.key, item.href]));

// The main tabs' bar (the tab navigator's `tabBar`), floating over the tab. Settings has none.
export default function FloatingNavigationBar({ state }) {
  const insets = useSafeAreaInsets();
  const { isNavBarHidden, isSearchActive, isSelectMode, resetScroll } = useFloatingBars();

  const activeTab = state.routes[state.index].name;
  const hideBar = isSearchActive || activeTab === 'settings' || isSelectMode;

  // Toggle-driven: search / select / Settings — animated both ways via shared value
  const contextHidden = useSharedValue(hideBar ? 1 : 0);
  useEffect(() => {
    contextHidden.value = withTiming(hideBar ? 1 : 0, hideBar ? motion.exit : motion.enter);
  }, [hideBar]);

  const navBarStyle = useAnimatedStyle(() => {
    // Scroll-driven: isNavBarHidden is already animated at the source (scroll handler)
    const scrollTranslate = interpolate(isNavBarHidden.value, [0, 1], [0, 100]);
    const scrollOpacity = interpolate(isNavBarHidden.value, [0, 1], [1, 0]);
    // Toggle-driven: search / select / Settings
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
    router.navigate(HREFS[tab]);
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          bottom: insets.bottom + layout.barBottom,
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
