import { BlurView } from 'expo-blur';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import Icon from '@/components/Icon';
import { colors, lineHeights, motion, radii, scale, typography } from '@/styles/designTokens';

const ICON_SIZE = scale(16);
// While hidden every name takes this one width, so its length gives nothing away.
const HIDDEN_WIDTH = scale(96);

// A compare card's real model name, hidden under a blur of the same width for every model until
// tapped; a second tap hides it again.
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
      {isShown ? (
        <Text style={[styles.name, styles.shownName]} numberOfLines={1}>
          {name}
        </Text>
      ) : (
        <View style={styles.hiddenName} />
      )}
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
  // The name isn't laid out while hidden: a blank of one width under the blur.
  hiddenName: {
    width: HIDDEN_WIDTH,
    height: lineHeights.subheadline,
  },
  shownName: {
    color: colors.accent.base,
    fontWeight: '600',
  },
});
