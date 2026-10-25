import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, radii, typography } from '@/styles/designTokens';

// A tag a model gave a photo: grey, or accent once tapped as fitting. Only its colors change, so a
// tap never changes its width and moves the tags after it.
export default function TagChip({ label, isOn, onToggle }) {
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isOn }}
      style={({ pressed }) => [styles.chip, isOn && styles.on, pressed && styles.pressed]}
    >
      <Text style={[styles.label, isOn && styles.onLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: radii.pill,
    backgroundColor: colors.background.muted,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  on: {
    backgroundColor: colors.accent.light,
  },
  pressed: {
    opacity: 0.6,
  },
  label: {
    fontSize: typography.subheadline,
    color: colors.text.primary,
  },
  onLabel: {
    color: colors.accent.base,
  },
});
