import type { ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import Icon, { type IconName } from '@/components/Icon';
import chipFrame from '@/styles/chipFrame';
import {
  colors,
  disabledOpacity,
  layout,
  press,
  scale,
  shadows,
  sizes,
  space,
  textStyles,
} from '@/styles/designTokens';

export type ChipVariant = 'tag' | 'action' | 'raised' | 'lead' | 'add';

export type ChipProps = Pick<
  PressableProps,
  'onPress' | 'disabled' | 'accessibilityRole' | 'accessibilityLabel' | 'accessibilityHint'
> & {
  label: string;
  variant?: ChipVariant;
  icon?: IconName;
  leading?: ReactNode;
  onRemove?: () => void;
  removeLabel?: string;
  isSelected?: boolean;
  size?: 'regular' | 'large';
  style?: StyleProp<ViewStyle>;
};

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
 * (a contact's chip avatar, sizes.avatar.chip) and the label stays on one line, cut short when the
 * chip would be wider than its row. `isSelected` tells VoiceOver it's on (as
 * checked when `accessibilityRole` is a checkbox). `disabled` dims it and takes no presses. Without
 * `onPress` it is a plain label, so it can sit inside a pressable (a tap goes to the parent).
 * `onRemove` ends it with a ×, as a row's × takes it off (a contact on a photo); `removeLabel` is
 * what VoiceOver reads for it.
 * `size="large"` is taller with a bigger label, for a row of people (a photo's contacts); a large tag
 * has a hairline, so it looks the same on a screen's grey and on a white panel.
 * style is for layout only.
 */
export default function Chip({
  label,
  variant = 'tag',
  icon,
  leading,
  onRemove,
  removeLabel = 'Remove',
  isSelected = false,
  disabled = false,
  onPress,
  accessibilityRole = 'button',
  accessibilityLabel,
  accessibilityHint,
  size = 'regular',
  style,
}: ChipProps) {
  const isLarge = size === 'large';
  const leadingIcon = variant === 'add' ? 'add' : icon;
  const isAccentFill = variant === 'lead' || (variant === 'tag' && isSelected);
  const isAccent = isAccentFill || variant === 'add';
  const isLifted = variant === 'raised' || variant === 'lead';
  const frame = [
    chipFrame,
    styles.chip,
    VARIANT_STYLES[variant],
    isAccentFill && styles.accentFill,
    isLifted && styles.lifted,
    !!leading && styles.withLeading,
    isLarge && styles.large,
    isLarge && variant === 'tag' && !isSelected && styles.largeTag,
    isLarge && !!leading && styles.largeWithLeading,
  ];
  const content = (
    <>
      {leading ?? (leadingIcon && <Icon name={leadingIcon} size={sizes.menuIcon} color={colors.accent.base} />)}
      <Text
        style={[
          styles.label,
          styles.shrinks,
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

  const remove = onRemove && (
    <Pressable
      onPress={onRemove}
      hitSlop={space.sm}
      accessibilityRole="button"
      accessibilityLabel={removeLabel}
      style={({ pressed }) => [styles.remove, pressed && press.flat]}
    >
      <Icon name="close" size={sizes.menuIcon} color={colors.text.secondary} />
    </Pressable>
  );

  if (remove) {
    return (
      <View style={[frame, styles.withRemove, disabled && styles.disabled, style]}>
        <Pressable
          onPress={onPress}
          hitSlop={space.xs}
          disabled={disabled}
          accessibilityRole={accessibilityRole}
          accessibilityLabel={accessibilityLabel}
          accessibilityHint={accessibilityHint}
          style={({ pressed }) => [styles.chip, styles.shrinks, pressed && press.flat]}
        >
          {content}
        </Pressable>
        {remove}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      // With the frame's height and a row's gaps, a 44 pt pitch.
      hitSlop={space.xs}
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
  // No wider than its row: a long name is cut short (a contact's label is one line).
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.iconGap,
    maxWidth: '100%',
  },
  shrinks: {
    flexShrink: 1,
  },
  tag: {
    backgroundColor: colors.background.muted,
  },
  // The node sits close to the frame's start, as an avatar in a pill does.
  withLeading: {
    paddingLeft: space.hair,
    paddingRight: space.md + space.hair,
  },
  // The label space.lg from the pill's edge, as the frame's is space.md.
  large: {
    height: scale(40),
    paddingHorizontal: space.lg - chipFrame.borderWidth,
  },
  largeWithLeading: {
    paddingLeft: space.xs - chipFrame.borderWidth,
    paddingRight: space.md,
  },
  // The tag's grey with a hairline, so a person's chip looks the same on a screen's grey, where the
  // fill alone would fade, and on a white panel (a photo's details).
  largeTag: {
    borderColor: colors.border.divider,
  },
  largeLabel: textStyles.body,
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
  // The × sits in the pill's end padding, as close to the label as the leading node is.
  withRemove: {
    paddingRight: space.xs,
  },
  remove: {
    padding: space.hair,
  },
  label: {
    ...textStyles.subheadline,
    color: colors.text.primary,
  },
  accentLabel: {
    color: colors.accent.base,
  },
  leadLabel: {
    fontWeight: '600',
  },
});

// Each variant's own look, where it has one (`lead` is `accentFill` and `lifted`).
const VARIANT_STYLES: Partial<Record<ChipVariant, ViewStyle>> = {
  tag: styles.tag,
  action: styles.action,
  raised: styles.raised,
  add: styles.add,
};
