import { BlurView } from 'expo-blur';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import Icon from '@/components/Icon';
import { colors, motion, radii, scale, typography } from '@/styles/designTokens';

const ICON_SIZE = scale(16);

// A compare card's real model name, blurred until tapped; a second tap hides it again.
export default function BlindModelName({ name }) {
  const [isShown, setIsShown] = useState(false);
  const hidden = useSharedValue(1);
  const blurStyle = useAnimatedStyle(() => ({ opacity: hidden.value }));

  useEffect(() => {
    hidden.value = withTiming(isShown ? 0 : 1, motion.move);
  }, [isShown]);

  return (
    <Pressable
      onPress={() => setIsShown(!isShown)}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={isShown ? `${name}, hide the name` : 'Show the model name'}
      style={[styles.pill, isShown && styles.shown]}
    >
      <Text
        style={[styles.name, isShown ? styles.shownName : styles.hiddenName]}
        numberOfLines={1}
        accessibilityElementsHidden={!isShown}
      >
        {name}
      </Text>
      <Animated.View style={[StyleSheet.absoluteFill, blurStyle]} pointerEvents="none">
        <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Icon
        name={isShown ? 'eye-off' : 'eye'}
        size={ICON_SIZE}
        color={isShown ? colors.accent.base : colors.text.secondary}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radii.pill,
    overflow: 'hidden',
    backgroundColor: colors.background.muted,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  shown: {
    backgroundColor: colors.accent.light,
  },
  name: {
    flexShrink: 1,
    fontSize: typography.subheadline,
    color: colors.text.primary,
  },
  // Faint under the blur, so the blur alone never has to hide it (it is weaker on web).
  hiddenName: {
    opacity: 0.15,
  },
  shownName: {
    color: colors.accent.base,
    fontWeight: '600',
  },
});
