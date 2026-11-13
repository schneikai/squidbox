import { Tabs, type BottomTabBarProps, type TabsScreenOptions } from 'expo-router/js-tabs';

import FloatingNavigationBar from '@/components/floating-bars/FloatingNavigationBar';
import { motion } from '@/styles/designTokens';

// expo-router/js-tabs exports the options type but not the interpolator's prop types.
type SceneInterpolation = Parameters<NonNullable<TabsScreenOptions['sceneStyleInterpolator']>>[0];

// A tab fades in and slides from its side: `progress` is -1 for a tab left of the shown one, 1 for
// one to its right.
function slideFromSide({ current }: SceneInterpolation) {
  return {
    sceneStyle: {
      opacity: current.progress.interpolate({ inputRange: [-1, 0, 1], outputRange: [0, 1, 0] }),
      transform: [
        {
          translateX: current.progress.interpolate({
            inputRange: [-1, 0, 1],
            outputRange: [-motion.slideDistance, 0, motion.slideDistance],
          }),
        },
      ],
    },
  };
}

const SCREEN_OPTIONS = {
  headerShown: false,
  sceneStyleInterpolator: slideFromSide,
  transitionSpec: { animation: 'timing', config: motion.enter },
} satisfies TabsScreenOptions;

function renderTabBar(props: BottomTabBarProps) {
  return <FloatingNavigationBar {...props} />;
}

// The main tabs, switched with the floating navigation bar. Settings opens from the account button.
export default function TabsLayout() {
  return (
    <Tabs tabBar={renderTabBar} screenOptions={SCREEN_OPTIONS}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="albums" />
      <Tabs.Screen name="contacts" />
      <Tabs.Screen name="posts" />
      <Tabs.Screen name="settings" />
    </Tabs>
  );
}
