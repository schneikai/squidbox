import { BlurView } from 'expo-blur';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import Button from '@/components/Button';
import { colors, motion, space, textStyles } from '@/styles/designTokens';

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
    blur.value = withTiming(0, motion.move, (finished) => finished && scheduleOnRN(setIsRevealing, false));
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
        <Text style={[textStyles.bodyBold, styles.label, isShown && styles.name]} numberOfLines={1}>
          {isShown ? name : label}
        </Text>
        {isRevealing && (
          <Animated.View style={[StyleSheet.absoluteFill, blurStyle]} pointerEvents="none">
            <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
          </Animated.View>
        )}
      </View>
      <Button
        icon={isShown ? 'eye-off' : 'eye'}
        variant="secondary"
        isSelected={isShown}
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
    gap: space.md,
  },
  text: {
    flexShrink: 1,
    overflow: 'hidden',
  },
  label: {
    color: colors.text.primary,
  },
  name: {
    color: colors.accent.base,
  },
});
