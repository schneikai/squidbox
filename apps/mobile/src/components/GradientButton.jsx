import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet } from 'react-native';

import { colors, shadows, spacing, radii } from '@/styles/designTokens';

export default function GradientButton({ onPress, children, style, disabled = false }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.pressable, pressed && styles.pressed, disabled && styles.disabled, style]}
    >
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        {children}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    borderRadius: radii.pill,
    width: spacing.iconButtonSize,
    height: spacing.iconButtonSize,
    ...shadows.accent,
  },
  gradient: {
    flex: 1,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.95 }],
  },
  disabled: {
    opacity: 0.4,
  },
});
