import { Tabs } from 'expo-router/js-tabs';

import FloatingNavigationBar from '@/components/floating-bars/FloatingNavigationBar';
import { motion } from '@/styles/designTokens';

const SLIDE_DISTANCE = 40; // a subtle nudge toward the tab's side, not a full-page swipe

// A tab fades in and slides from its side: `progress` is -1 for a tab left of the shown one, 1 for
// one to its right.
function slideFromSide({ current }) {
  return {
    sceneStyle: {
      opacity: current.progress.interpolate({ inputRange: [-1, 0, 1], outputRange: [0, 1, 0] }),
      transform: [
        {
          translateX: current.progress.interpolate({
            inputRange: [-1, 0, 1],
            outputRange: [-SLIDE_DISTANCE, 0, SLIDE_DISTANCE],
          }),
        },
      ],
    },
  };
}

const SCREEN_OPTIONS = {
  headerShown: false,
  sceneStyle: { backgroundColor: 'transparent' },
  sceneStyleInterpolator: slideFromSide,
  transitionSpec: { animation: 'timing', config: motion.enter },
};

function renderTabBar(props) {
  return <FloatingNavigationBar {...props} />;
}

// The main tabs, switched with the floating navigation bar. Settings opens from the account button.
export default function TabsLayout() {
  return (
    <Tabs tabBar={renderTabBar} screenOptions={SCREEN_OPTIONS}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="albums" />
      <Tabs.Screen name="posts" />
      <Tabs.Screen name="settings" />
    </Tabs>
  );
}
