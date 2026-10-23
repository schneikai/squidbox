import { useNavigationState } from '@react-navigation/native';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, interpolate } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useFloatingBars } from './FloatingBarsContext';
import SegmentedPill from './SegmentedPill';
import { getActiveTabName, isDetailScreenActive } from './navStateHelpers';

import { navigateToTab } from '@/navigators/navigationRef';
import { layout, motion } from '@/styles/designTokens';

const NAV_ITEMS = [
  { key: 'AssetsTab', icon: 'grid', label: 'Library' },
  { key: 'AlbumsTab', icon: 'folder', label: 'Albums' },
  { key: 'PostsTab', icon: 'share-alt', label: 'Posts' },
];

const MAIN_TABS = NAV_ITEMS.map((item) => item.key);

export default function FloatingNavigationBar() {
  const insets = useSafeAreaInsets();
  const { isNavBarHidden, isSearchActive, isSelectMode, resetScroll } = useFloatingBars();

  const activeTab = useNavigationState((s) => getActiveTabName(s));
  const isDetailActive = useNavigationState((s) => isDetailScreenActive(s));
  const isMainScreen = !isDetailActive && MAIN_TABS.includes(activeTab);

  const hideBar = isSearchActive || !isMainScreen || isSelectMode;

  // Toggle-driven: search / select / depth — animated both ways via shared value
  const contextHidden = useSharedValue(hideBar ? 1 : 0);
  useEffect(() => {
    contextHidden.value = withTiming(hideBar ? 1 : 0, hideBar ? motion.exit : motion.enter);
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
    // Goes through the container ref (see navigationRef.js): honored immediately when ready, and
    // remembered + flushed if the container is still mounting (first-sync gate flip).
    navigateToTab(tab);
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
