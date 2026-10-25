import { BlurView } from 'expo-blur';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import Icon from '@/components/Icon';
import { colors, lineHeights, motion, radii, scale, typography } from '@/styles/designTokens';

const ICON_SIZE = scale(16);
// While hidden every name takes this one width, so its length gives nothing away.
const HIDDEN_WIDTH = scale(96);

// A compare card's real model name, a blank pill of the same width for every model until tapped;
// a second tap hides it again. The name comes out from under a blur that fades: a blur is costly,
// so it is there only for the fade (a compare has a name on every card of every photo).
export default function BlindModelName({ name }) {
  const [isShown, setIsShown] = useState(false);
  const [isRevealing, setIsRevealing] = useState(false);
  const blur = useSharedValue(1);
  const blurStyle = useAnimatedStyle(() => ({ opacity: blur.value }));

  useEffect(() => {
    if (!isRevealing) return;
    blur.value = 1;
    blur.value = withTiming(0, motion.move, (finished) => finished && runOnJS(setIsRevealing)(false));
  }, [isRevealing]);

  function handlePress() {
    setIsShown(!isShown);
    setIsRevealing(!isShown);
  }

  return (
    <Pressable
      onPress={handlePress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={isShown ? `${name}, hide the name` : 'Show the model name'}
      style={[styles.pill, isShown && styles.shown]}
    >
      {isShown ? (
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
      ) : (
        <View style={styles.hiddenName} />
      )}
      {isRevealing && (
        <Animated.View style={[StyleSheet.absoluteFill, blurStyle]} pointerEvents="none">
          <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
        </Animated.View>
      )}
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
    fontWeight: '600',
    color: colors.accent.base,
  },
  // The name isn't laid out while hidden: a blank of one width.
  hiddenName: {
    width: HIDDEN_WIDTH,
    height: lineHeights.subheadline,
  },
});
