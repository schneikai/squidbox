import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, radii, scale, spacing } from '@/styles/designTokens';

/**
 * Gradient text-label action button for use inside FloatingPill containers
 * in modal headers (e.g. "Save Post", "Save", "Add").
 *
 * Sized to fill its FloatingPill host — no own shadow or minHeight, since
 * FloatingPill provides the outer container, shadow, and tap-target sizing.
 */
export default function GradientPillButton({ label, onPress, disabled = false }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.pressable, pressed && styles.pressed, disabled && styles.disabled]}
    >
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <Text style={styles.label}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  gradient: {
    borderRadius: radii.pill,
    paddingHorizontal: scale(16),
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: spacing.iconButtonSize,
  },
  label: {
    color: colors.textInverse,
    fontSize: scale(15),
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  disabled: {
    opacity: 0.4,
  },
});
