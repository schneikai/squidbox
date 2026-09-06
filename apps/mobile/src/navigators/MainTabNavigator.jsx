import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useRef } from 'react';
import { Animated, Easing } from 'react-native';

import AlbumNavigator from '@/navigators/AlbumNavigator';
import AssetNavigator from '@/navigators/AssetNavigator';
import PostNavigator from '@/navigators/PostNavigator';
import SettingsNavigator from '@/navigators/SettingsNavigator';

// Shared ref so every tab instance can read the previously-active tab index
// and derive the slide direction without needing a context.
const prevTabIndexRef = { current: 0 };

const SLIDE_DISTANCE = 40; // px — subtle directional nudge, not a full-page swipe

/**
 * Wraps a tab screen's navigator in a combined fade + directional slide
 * animation that plays each time the tab gains focus.
 *
 * tabIndex must match the logical order of the tabs so the direction
 * (slide from left vs right) is computed correctly.
 */
function AnimatedTab({ children, tabIndex }) {
  const opacity = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    useCallback(() => {
      // Only animate on an actual tab switch. When a modal is dismissed the
      // screen regains focus without the tab index changing, so we skip it.
      if (tabIndex === prevTabIndexRef.current) return;

      const direction = tabIndex >= prevTabIndexRef.current ? 1 : -1;
      prevTabIndexRef.current = tabIndex;

      opacity.setValue(0);
      translateX.setValue(direction * SLIDE_DISTANCE);

      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 240,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: 0,
          duration: 240,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }, [tabIndex]),
  );

  return <Animated.View style={{ flex: 1, opacity, transform: [{ translateX }] }}>{children}</Animated.View>;
}

const FadeAssetNavigator = () => (
  <AnimatedTab tabIndex={0}>
    <AssetNavigator />
  </AnimatedTab>
);
const FadeAlbumNavigator = () => (
  <AnimatedTab tabIndex={1}>
    <AlbumNavigator />
  </AnimatedTab>
);
const FadePostNavigator = () => (
  <AnimatedTab tabIndex={2}>
    <PostNavigator />
  </AnimatedTab>
);
const FadeSettingsNavigator = () => (
  <AnimatedTab tabIndex={3}>
    <SettingsNavigator />
  </AnimatedTab>
);

const Tab = createBottomTabNavigator();

export default function MainTabNavigator() {
  return (
    <Tab.Navigator tabBar={() => null} sceneContainerStyle={{ backgroundColor: 'transparent' }}>
      <Tab.Screen name="AssetsTab" component={FadeAssetNavigator} options={{ headerShown: false }} />
      <Tab.Screen name="AlbumsTab" component={FadeAlbumNavigator} options={{ headerShown: false }} />
      <Tab.Screen name="PostsTab" component={FadePostNavigator} options={{ headerShown: false }} />
      <Tab.Screen name="SettingsTab" component={FadeSettingsNavigator} options={{ headerShown: false }} />
    </Tab.Navigator>
  );
}
