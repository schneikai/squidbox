import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import Octopus from '@/components/octopus/Octopus';
import { splashOctopusFrame } from '@/components/octopus/splashOctopusFrame';
import { colors, motion } from '@/styles/designTokens';

// Takes over from the native splash, pixel for pixel, so the octopus can come alive while the app
// boots: it hides the native splash once it has been drawn, fades out once `leaving`, and is gone then.
export default function BootScreen({ leaving }) {
  const window = useWindowDimensions();
  const opacity = useSharedValue(1);
  const [gone, setGone] = useState(false);
  const octopus = splashOctopusFrame(window);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  useEffect(() => {
    if (!leaving) return;
    opacity.value = withTiming(0, motion.exit, () => runOnJS(setGone)(true));
  }, [leaving, opacity]);

  if (gone) return null;

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.root, fadeStyle]}
      pointerEvents={leaving ? 'none' : 'auto'}
      onLayout={hideNativeSplash}
    >
      <View style={{ position: 'absolute', left: octopus.left, top: octopus.top }}>
        <Octopus size={octopus.width} />
      </View>
    </Animated.View>
  );
}

// After layout, the next frame: by then the laid-out boot screen, octopus included, is on screen.
function hideNativeSplash() {
  requestAnimationFrame(() => SplashScreen.hideAsync().catch(() => {}));
}

const styles = StyleSheet.create({
  root: { backgroundColor: colors.splashBackground },
});
