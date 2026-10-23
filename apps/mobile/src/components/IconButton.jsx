import { Pressable, StyleSheet } from 'react-native';

import Icon from '@/components/Icon';
import actionButtonStyles from '@/styles/actionButtonStyles';
import { colors, spacing } from '@/styles/designTokens';

/**
 * Standard icon-only pressable with a 44pt tap target, pill clipping, and press feedback. Every
 * icon-only button uses it, in a toolbar (FloatingPill) or on its own. No hit slop by default:
 * buttons sit flush in a toolbar, so a slop would steal taps from the neighbour.
 *
 * isActive — accent tint, for a control whose setting is on (e.g. a sort or filter is active).
 * danger   — red icon and press tint, for a destructive action.
 * filled   — fills the icon (see Icon), e.g. a favorite's heart.
 *
 * Not for: send button (circular accent), media nav arrows, gradient buttons.
 *
 * style applies to the Pressable (the tap target / visual container).
 */
export default function IconButton({
  icon,
  onPress,
  color = colors.text,
  size = spacing.iconSize,
  hitSlop = 0,
  disabled = false,
  isActive = false,
  danger = false,
  filled,
  accessibilityLabel,
  style,
}) {
  const iconColor = disabled ? colors.textTertiary : danger ? colors.danger : isActive ? colors.accent : color;

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      hitSlop={hitSlop}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled, selected: isActive }}
      style={({ pressed }) => [
        actionButtonStyles.pillButton,
        isActive && styles.active,
        !disabled && pressed && (danger ? styles.dangerPressed : styles.pressed),
        disabled && styles.disabled,
        style,
      ]}
    >
      <Icon name={icon} size={size} color={iconColor} filled={filled} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  active: {
    backgroundColor: colors.accentLight,
  },
  pressed: {
    backgroundColor: colors.pressedBg,
  },
  dangerPressed: {
    backgroundColor: colors.dangerLight,
  },
  disabled: {
    opacity: 0.4,
  },
});
