import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import SplashStage from '@/components/SplashStage';
import { motion } from '@/styles/designTokens';

export type BootScreenProps = { leaving: boolean };

// Takes over from the native splash, pixel for pixel, so the octopus can come alive while the app
// boots: it hides the native splash once it has been drawn, fades out once `leaving`, and is gone then.
export default function BootScreen({ leaving }: BootScreenProps) {
  const opacity = useSharedValue(1);
  const [gone, setGone] = useState(false);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  useEffect(() => {
    if (!leaving) return;
    opacity.value = withTiming(0, motion.exit, () => scheduleOnRN(setGone, true));
  }, [leaving, opacity]);

  if (gone) return null;

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, fadeStyle]}
      pointerEvents={leaving ? 'none' : 'auto'}
      onLayout={hideNativeSplash}
    >
      <SplashStage isLeaving={leaving} />
    </Animated.View>
  );
}

// After layout, the next frame: by then the laid-out boot screen, octopus included, is on screen.
function hideNativeSplash() {
  requestAnimationFrame(() => SplashScreen.hideAsync().catch(() => {}));
}
