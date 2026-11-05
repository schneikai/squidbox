import { Pressable, StyleSheet, Text, View } from 'react-native';

import Icon from '@/components/Icon';
import chipFrame from '@/styles/chipFrame';
import { colors, disabledOpacity, lineHeights, press, scale, shadows, sizes, typography } from '@/styles/designTokens';

/**
 * A pill with a short label. `variant` says what it is: `tag` (the default: grey, violet once
 * `isSelected`), `action` (white with a violet frame, a prompt button), `raised` (white and lifted
 * by a soft shadow, a prompt button in a row of them: the assistant's tray, over the chat's
 * composer), `lead` (light violet with a semibold violet label, lifted like `raised`, the
 * assistant's own action at the end of a row of prompt buttons: Ask anything) or `add` (the
 * dashed Add at the end of a row, with its plus). Every variant has the same frame, so a tag
 * tapped on never changes its width and moves the chips after it.
 *
 * icon — leads the label (Icon name), in the accent color; `leading` leads it instead with a node
 * (a contact's chip avatar, sizes.avatar.chip) and the label stays on one line. `isSelected` tells VoiceOver it's on (as
 * checked when `accessibilityRole` is a checkbox). `disabled` dims it and takes no presses. Without
 * `onPress` it is a plain label, so it can sit inside a pressable (a tap goes to the parent).
 * `size="large"` is taller with a bigger label, for a row of people (a photo's contacts).
 * style is for layout only.
 */
export default function Chip({
  label,
  variant = 'tag',
  icon,
  leading,
  isSelected = false,
  disabled = false,
  onPress,
  accessibilityRole = 'button',
  accessibilityLabel,
  accessibilityHint,
  size = 'regular',
  style,
}) {
  const isLarge = size === 'large';
  const leadingIcon = variant === 'add' ? 'add' : icon;
  const isAccentFill = variant === 'lead' || (variant === 'tag' && isSelected);
  const isAccent = isAccentFill || variant === 'add';
  const isLifted = variant === 'raised' || variant === 'lead';
  const frame = [
    chipFrame,
    styles.chip,
    styles[variant],
    isAccentFill && styles.accentFill,
    isLifted && styles.lifted,
    !!leading && styles.withLeading,
    isLarge && styles.large,
    isLarge && !!leading && styles.largeWithLeading,
  ];
  const content = (
    <>
      {leading ?? (leadingIcon && <Icon name={leadingIcon} size={sizes.menuIcon} color={colors.accent.base} />)}
      <Text
        style={[
          styles.label,
          isLarge && styles.largeLabel,
          isAccent && styles.accentLabel,
          variant === 'lead' && styles.leadLabel,
        ]}
        numberOfLines={leading ? 1 : undefined}
      >
        {label}
      </Text>
    </>
  );

  if (!onPress) {
    return (
      <View accessibilityLabel={accessibilityLabel} style={[frame, disabled && styles.disabled, style]}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={accessibilityRole}
      accessibilityState={
        accessibilityRole === 'checkbox' ? { checked: isSelected, disabled } : { selected: isSelected, disabled }
      }
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [frame, pressed && press.flat, disabled && styles.disabled, style]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tag: {
    backgroundColor: colors.background.muted,
  },
  // The node sits close to the frame's start, as an avatar in a pill does.
  withLeading: {
    paddingLeft: 2,
    paddingRight: 14,
  },
  large: {
    height: scale(40),
    gap: 8,
    paddingHorizontal: 15,
  },
  largeWithLeading: {
    paddingLeft: 3,
    paddingRight: 13,
  },
  largeLabel: {
    fontSize: typography.callout,
    fontWeight: '500',
  },
  // A selected tag and the `lead` chip.
  accentFill: {
    backgroundColor: colors.accent.light,
  },
  action: {
    backgroundColor: colors.background.surface,
    borderColor: colors.accent.border,
  },
  raised: {
    backgroundColor: colors.background.surface,
  },
  // `raised` and `lead`.
  lifted: {
    ...shadows.raised,
  },
  add: {
    borderColor: colors.accent.border,
    borderStyle: 'dashed',
  },
  disabled: {
    opacity: disabledOpacity,
  },
  label: {
    fontSize: typography.subheadline,
    lineHeight: lineHeights.subheadline,
    color: colors.text.primary,
  },
  accentLabel: {
    color: colors.accent.base,
  },
  leadLabel: {
    fontWeight: '600',
  },
});
