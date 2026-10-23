import { Pressable, StyleSheet } from 'react-native';

import GradientFill from '@/components/GradientFill';
import Icon from '@/components/Icon';
import { colors, radii, spacing } from '@/styles/designTokens';

/**
 * Standard icon-only pressable with a 44pt tap target, pill clipping, and press feedback. Every
 * icon-only button uses it, in a toolbar (FloatingPill) or on its own. No hit slop by default:
 * buttons sit flush in a toolbar, so a slop would steal taps from the neighbour.
 *
 * variant  — in a toolbar: `plain` (the default) or `danger` (a red icon, for a destructive
 *            action); `primary` (the violet gradient, at most one per toolbar, flat in its
 *            FloatingPill). Over content: `tinted` (a grey disc) or `destructive` (a red disc).
 * isActive — accent tint, for a control whose setting is on (e.g. a filter is active).
 * filled   — fills the icon (see Icon), e.g. a favorite's heart.
 *
 * style applies to the Pressable (the tap target / visual container).
 */
export default function IconButton({
  icon,
  onPress,
  variant = 'plain',
  color = colors.text,
  size = spacing.iconSize,
  hitSlop = 0,
  disabled = false,
  isActive = false,
  filled,
  accessibilityLabel,
  style,
}) {
  const iconElement = (
    <Icon name={icon} size={size} color={iconColorFor(variant, { color, disabled, isActive })} filled={filled} />
  );

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      hitSlop={hitSlop}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled, selected: isActive }}
      style={({ pressed }) => [
        styles.button,
        styles[variant],
        isActive && styles.active,
        !disabled && pressed && pressedStyles[variant],
        disabled && styles.disabled,
        style,
      ]}
    >
      {variant === 'primary' ? <GradientFill style={styles.gradient}>{iconElement}</GradientFill> : iconElement}
    </Pressable>
  );
}

function iconColorFor(variant, { color, disabled, isActive }) {
  if (variant === 'primary' || variant === 'destructive') return colors.textInverse;
  if (disabled) return colors.textTertiary;
  if (variant === 'danger') return colors.danger;
  if (isActive) return colors.accent;
  return color;
}

const styles = StyleSheet.create({
  button: {
    width: spacing.iconButtonSize,
    height: spacing.iconButtonSize,
    borderRadius: radii.pill,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tinted: {
    backgroundColor: colors.pressedBg,
  },
  destructive: {
    backgroundColor: colors.danger,
  },
  active: {
    backgroundColor: colors.accentLight,
  },
  disabled: {
    opacity: 0.4,
  },
});

// A button without a fill tints on press; a disc dims and shrinks.
const discPressed = { opacity: 0.85, transform: [{ scale: 0.95 }] };
const pressedStyles = StyleSheet.create({
  plain: { backgroundColor: colors.pressedBg },
  danger: { backgroundColor: colors.dangerLight },
  tinted: discPressed,
  primary: discPressed,
  destructive: discPressed,
});
