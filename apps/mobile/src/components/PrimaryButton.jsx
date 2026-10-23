import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import GradientFill from '@/components/GradientFill';
import Icon from '@/components/Icon';
import { colors, radii, scale, sizes, typography } from '@/styles/designTokens';

/**
 * The violet primary action with a label: `large` fills the width of a form or list ("Sign In",
 * "New Post"), `compact` sits in a modal header's FloatingPill ("Save", "Add 3"), flat, since the
 * pill casts the shadow. Without a label it's a square of the large size, for an icon-only action
 * beside a large one. `loading` shows a spinner and blocks presses.
 *
 * style is for layout (e.g. `flex: 1` in a row).
 */
export default function PrimaryButton({
  label,
  icon,
  onPress,
  size = 'large',
  loading = false,
  disabled = false,
  accessibilityLabel,
  style,
}) {
  const isInactive = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isInactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isInactive, busy: loading }}
      style={({ pressed }) => [
        styles.button,
        styles[size],
        !label && styles.square,
        pressed && styles.pressed,
        isInactive && styles.disabled,
        style,
      ]}
    >
      <GradientFill style={[styles.fill, size === 'compact' && styles.compactFill, !label && styles.squareFill]}>
        {loading ? (
          <ActivityIndicator color={colors.text.inverse} />
        ) : (
          <>
            {icon && <Icon name={icon} size={sizes.icon} color={colors.text.inverse} />}
            {!!label && <Text style={[styles.label, size === 'compact' && styles.compactLabel]}>{label}</Text>}
          </>
        )}
      </GradientFill>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    overflow: 'hidden',
  },
  fill: {
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(8),
    paddingHorizontal: scale(20),
  },
  large: {
    height: sizes.primaryButton,
    borderRadius: radii.card,
  },
  compact: {
    height: sizes.iconButton,
    borderRadius: radii.pill,
  },
  square: {
    aspectRatio: 1,
  },
  compactFill: {
    paddingHorizontal: scale(16),
  },
  squareFill: {
    paddingHorizontal: 0,
  },
  label: {
    color: colors.text.inverse,
    fontSize: typography.callout,
    fontWeight: '600',
  },
  compactLabel: {
    fontSize: typography.subheadline,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  disabled: {
    opacity: 0.4,
  },
});
