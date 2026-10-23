import { Pressable, StyleSheet, Text } from 'react-native';

import Icon from '@/components/Icon';
import { colors, scale } from '@/styles/designTokens';

const TONE_COLORS = { accent: colors.accent, muted: colors.textSecondary, inverse: colors.textInverse };

// A secondary action as a line of text ("Sign in as someone else", "Try again"). `tone`: `accent`,
// `muted` for one that should not draw the eye, or `inverse` on a dark overlay. `size="small"` fits
// it into a header row; `icon` leads the label.
export default function TextButton({ label, icon, onPress, tone = 'accent', size = 'regular' }) {
  const color = TONE_COLORS[tone];
  const isSmall = size === 'small';

  return (
    <Pressable
      style={({ pressed }) => [styles.button, isSmall && styles.small, pressed && styles.pressed]}
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
    >
      {icon && <Icon name={icon} size={isSmall ? scale(14) : scale(16)} color={color} />}
      <Text style={[styles.label, isSmall && styles.smallLabel, tone === 'muted' && styles.muted, { color }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(4),
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  small: { paddingVertical: 4, paddingHorizontal: 4 },
  pressed: { opacity: 0.6 },
  label: { fontSize: scale(15), fontWeight: '500' },
  smallLabel: { fontSize: scale(13) },
  muted: { fontWeight: '400' },
});
