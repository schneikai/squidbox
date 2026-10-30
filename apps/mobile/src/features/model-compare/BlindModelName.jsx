import { BlurView } from 'expo-blur';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import IconButton from '@/components/IconButton';
import { colors, motion, typography } from '@/styles/designTokens';

// A compare card's title: its letter (`label`, Model A) and an eye that puts the real model name in
// its place; a second tap hides it again. The name comes out from under a blur that fades: a blur is
// costly, so it is there only for the fade (a compare has a name on every card of every photo).
export default function BlindModelName({ label, name }) {
  const [isShown, setIsShown] = useState(false);
  const [isRevealing, setIsRevealing] = useState(false);
  const blur = useSharedValue(1);
  const blurStyle = useAnimatedStyle(() => ({ opacity: blur.value }));

  useEffect(() => {
    if (!isRevealing) return;
    blur.value = withTiming(0, motion.move, (finished) => finished && runOnJS(setIsRevealing)(false));
  }, [isRevealing]);

  function handlePress() {
    // Blurred from the first frame the name shows.
    if (!isShown) blur.value = 1;
    setIsShown(!isShown);
    setIsRevealing(!isShown);
  }

  return (
    <View style={styles.title}>
      <View style={styles.text}>
        <Text style={[styles.label, isShown && styles.name]} numberOfLines={1}>
          {isShown ? name : label}
        </Text>
        {isRevealing && (
          <Animated.View style={[StyleSheet.absoluteFill, blurStyle]} pointerEvents="none">
            <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
          </Animated.View>
        )}
      </View>
      <IconButton
        icon={isShown ? 'eye-off' : 'eye'}
        variant="tinted"
        color={colors.text.secondary}
        isActive={isShown}
        onPress={handlePress}
        accessibilityLabel={isShown ? `${name}, hide the name` : `Show the name of ${label}`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  text: {
    flexShrink: 1,
    overflow: 'hidden',
  },
  label: {
    fontSize: typography.callout,
    fontWeight: '600',
    color: colors.text.primary,
  },
  name: {
    color: colors.accent.base,
  },
});
