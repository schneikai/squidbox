import { Pressable, StyleSheet } from 'react-native';

import Icon from '@/components/Icon';
import actionButtonStyles from '@/styles/actionButtonStyles';
import { colors, spacing } from '@/styles/designTokens';

/**
 * Standard icon-only pressable with a 44pt tap target, pill clipping, and press feedback.
 * Replaces bare TouchableOpacity wrappers that lack sizing and repeated
 * Pressable + actionButtonStyles.pillButton + pressed && pressedBg + Ionicons blocks.
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
  hitSlop = 8,
  disabled = false,
  accessibilityLabel,
  style,
}) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      hitSlop={hitSlop}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        actionButtonStyles.pillButton,
        !disabled && pressed && { backgroundColor: colors.pressedBg },
        disabled && styles.disabled,
        style,
      ]}
    >
      <Icon name={icon} size={size} color={disabled ? colors.textTertiary : color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  disabled: {
    opacity: 0.4,
  },
});
