import { Pressable, StyleSheet, Text, View } from 'react-native';

import GradientFill from '@/components/GradientFill';
import Icon from '@/components/Icon';
import { colors, radii, scale, sizes, typography } from '@/styles/designTokens';

// Two icons side by side, small enough to fit the disc apart.
const PAIR_ICON_SIZE = scale(15);

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
 * label    — a few characters in place of the icon (18+), where no icon says it.
 * iconCount — the icon twice (2), smaller and side by side, for a second step of the same mark.
 *
 * style applies to the Pressable (the tap target / visual container).
 */
export default function IconButton({
  icon,
  label,
  iconCount = 1,
  onPress,
  variant = 'plain',
  color = colors.text.primary,
  size = sizes.icon,
  hitSlop = 0,
  disabled = false,
  isActive = false,
  filled,
  accessibilityLabel,
  style,
}) {
  const contentColor = iconColorFor(variant, { color, disabled, isActive });
  const iconSize = iconCount > 1 ? PAIR_ICON_SIZE : size;
  const icons = Array.from({ length: iconCount }, (_, index) => (
    <Icon key={index} name={icon} size={iconSize} color={contentColor} filled={filled} />
  ));
  const iconElement = label ? (
    <Text style={[styles.label, { color: contentColor }]}>{label}</Text>
  ) : iconCount > 1 ? (
    <View style={styles.pair}>{icons}</View>
  ) : (
    icons[0]
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
  if (variant === 'primary' || variant === 'destructive') return colors.text.inverse;
  if (disabled) return colors.text.tertiary;
  if (variant === 'danger') return colors.status.danger;
  if (isActive) return colors.accent.base;
  return color;
}

const styles = StyleSheet.create({
  button: {
    width: sizes.iconButton,
    height: sizes.iconButton,
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
    backgroundColor: colors.overlay.pressed,
  },
  destructive: {
    backgroundColor: colors.status.danger,
  },
  active: {
    backgroundColor: colors.accent.light,
  },
  disabled: {
    opacity: 0.4,
  },
  pair: {
    flexDirection: 'row',
    gap: 2,
  },
  label: {
    fontSize: typography.footnote,
    fontWeight: '700',
  },
});

// A button without a fill tints on press; a disc dims and shrinks.
const discPressed = { opacity: 0.85, transform: [{ scale: 0.95 }] };
const pressedStyles = StyleSheet.create({
  plain: { backgroundColor: colors.overlay.pressed },
  danger: { backgroundColor: colors.status.dangerLight },
  tinted: discPressed,
  primary: discPressed,
  destructive: discPressed,
});
