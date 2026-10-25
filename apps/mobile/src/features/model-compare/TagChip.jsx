import { Pressable, StyleSheet, Text } from 'react-native';

import Icon from '@/components/Icon';
import { colors, radii, scale, typography } from '@/styles/designTokens';

// A tag a model gave a photo: grey, or accent with a check once tapped as fitting.
export default function TagChip({ label, isOn, onToggle }) {
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isOn }}
      style={({ pressed }) => [styles.chip, isOn && styles.on, pressed && styles.pressed]}
    >
      {isOn && <Icon name="check" size={scale(14)} color={colors.accent.base} />}
      <Text style={[styles.label, isOn && styles.onLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
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
    fontWeight: '500',
  },
});
