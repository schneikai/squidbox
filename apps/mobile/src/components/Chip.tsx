import type { ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import Icon, { type IconName } from '@/components/Icon';
import chipFrame from '@/styles/chipFrame';
import { colors, disabledOpacity, layout, press, shadows, sizes, space, textStyles } from '@/styles/designTokens';

export type ChipVariant = 'tag' | 'raised' | 'lead' | 'add' | 'mixed';

export type ChipProps = Pick<
  PressableProps,
  'onPress' | 'disabled' | 'accessibilityRole' | 'accessibilityLabel' | 'accessibilityHint'
> & {
  label: string;
  detail?: string;
  variant?: ChipVariant;
  icon?: IconName;
  leading?: ReactNode;
  mark?: ReactNode;
  hasCaret?: boolean;
  isIconOnly?: boolean;
  isExpanded?: boolean;
  onRemove?: () => void;
  removeLabel?: string;
  isSelected?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * A pill with a short label. `variant` says what it is: `tag` (the default: a thing, such as a tag
 * or a contact, grey on white or on the page; plain white when it `isSelected`, a toggle that is on or
 * the tab a row of chips shows, such as a post's channel), `raised`
 * (white and lifted by a soft shadow, with a violet label and icon: a prompt button in the
 * assistant's tray, which is tinted),
 * `lead` (light violet with a semibold violet label, lifted like `raised`, the assistant's own
 * action leading a row of prompt buttons: Post ideas, Repost ideas), `add` (the grey dashed Add at the
 * end of a row, with its plus) or `mixed` (a tag on only some of the items, such as an album's
 * photos: no fill and a dashed outline; VoiceOver reads it as mixed). Every variant has the same
 * frame, so a tag tapped on never changes its width and moves the chips after it.
 *
 * icon — leads the label (Icon name), grey, or violet when it is the assistant's sparkle; `leading` leads it instead with a node
 * (a contact's chip avatar, sizes.avatar.chip) and the label stays on one line, cut short when the
 * chip would be wider than its row; `mark` takes the icon's place with a node of the icon's size (a
 * channel's logo). `hasCaret` ends it with a ⌄: it opens a menu (in a row of tabs, every tab that
 * opens one when selected has it, so none changes width), and `isExpanded` tells VoiceOver whether
 * that is open. `isIconOnly` is a round chip of its icon alone (the `add` + at the end of a
 * row of tabs); its label is then only what VoiceOver reads. `isSelected` tells VoiceOver it's on (as
 * checked when `accessibilityRole` is a checkbox). `disabled` dims it and takes no presses. Without
 * `onPress` it is a plain label, so it can sit inside a pressable (a tap goes to the parent).
 * `detail` follows the label in grey, after a ·: what tells it apart from a chip of the same label
 * (a city's state or country). `onRemove` ends it with a ×, as a row's × takes it off (a contact on a photo); `removeLabel` is
 * what VoiceOver reads for it.
 * style is for layout only.
 */
export default function Chip({
  label,
  detail,
  variant = 'tag',
  icon,
  leading,
  mark,
  hasCaret = false,
  isIconOnly = false,
  isExpanded,
  onRemove,
  removeLabel = 'Remove',
  isSelected = false,
  disabled = false,
  onPress,
  accessibilityRole = 'button',
  accessibilityLabel,
  accessibilityHint,
  style,
}: ChipProps) {
  const leadingIcon = variant === 'add' ? 'add' : icon;
  // Violet marks the assistant only: its fill and tray (`raised`, `lead`), and its sparkle.
  const isAccent = variant === 'lead' || variant === 'raised';
  const iconColor = isAccent || leadingIcon === 'sparkle' ? colors.accent.base : colors.text.secondary;
  const isLifted = variant === 'raised' || variant === 'lead';
  const frame = [
    chipFrame,
    styles.chip,
    VARIANT_STYLES[variant],
    variant === 'tag' && isSelected && styles.selected,
    isIconOnly && styles.iconOnly,
    isLifted && styles.lifted,
    !!leading && styles.withLeading,
  ];
  const accessibilityState =
    accessibilityRole === 'checkbox' ? { checked: isSelected, disabled } : { selected: isSelected, disabled };
  // A `mixed` tag reads as mixed, in the app and the web build alike (aria-checked reaches both).
  const ariaChecked = variant === 'mixed' ? ('mixed' as const) : undefined;
  // A tab says whether it is the one shown, pressable or not (the web build reads aria-selected only).
  const ariaSelected = accessibilityRole === 'tab' ? isSelected : undefined;
  const content = (
    <>
      {leading ?? mark ?? (leadingIcon && <Icon name={leadingIcon} size={sizes.menuIcon} color={iconColor} />)}
      {!isIconOnly && (
        <Text
          style={[styles.label, styles.shrinks, isAccent && styles.accentLabel, variant === 'lead' && styles.leadLabel]}
          numberOfLines={leading || mark ? 1 : undefined}
        >
          {label}
          {detail ? <Text style={styles.detail}>{` · ${detail}`}</Text> : null}
        </Text>
      )}
      {hasCaret && <Icon name="chevron-down" size={sizes.menuIcon} color={colors.text.secondary} />}
    </>
  );
  const a11yLabel = accessibilityLabel ?? (isIconOnly ? label : undefined);

  const remove = onRemove && (
    <Pressable
      onPress={onRemove}
      disabled={disabled}
      hitSlop={space.sm}
      accessibilityRole="button"
      accessibilityLabel={removeLabel}
      style={({ pressed }) => [styles.remove, pressed && press.flat]}
    >
      <Icon name="close" size={sizes.menuIcon} color={colors.text.secondary} />
    </Pressable>
  );

  if (!onPress && !remove) {
    return (
      <View
        accessibilityRole={ariaSelected === undefined ? undefined : 'tab'}
        accessibilityLabel={a11yLabel}
        aria-checked={ariaChecked}
        aria-selected={ariaSelected}
        style={[frame, disabled && styles.disabled, style]}
      >
        {content}
      </View>
    );
  }

  if (remove) {
    return (
      <View style={[frame, styles.withRemove, disabled && styles.disabled, style]}>
        {onPress ? (
          <Pressable
            onPress={onPress}
            hitSlop={space.xs}
            disabled={disabled}
            accessibilityRole={accessibilityRole}
            accessibilityState={accessibilityState}
            aria-checked={ariaChecked}
            accessibilityLabel={a11yLabel}
            accessibilityHint={accessibilityHint}
            style={({ pressed }) => [styles.chip, styles.shrinks, pressed && press.flat]}
          >
            {content}
          </Pressable>
        ) : (
          <View accessibilityLabel={a11yLabel} aria-checked={ariaChecked} style={[styles.chip, styles.shrinks]}>
            {content}
          </View>
        )}
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
      accessibilityState={accessibilityState}
      aria-checked={ariaChecked}
      aria-selected={ariaSelected}
      aria-expanded={isExpanded}
      accessibilityLabel={a11yLabel}
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
  // See-through, so a tag is a shade darker than what it sits on, a white card or a screen's grey.
  tag: {
    backgroundColor: colors.background.fill,
  },
  // The node sits close to the frame's start, as an avatar in a pill does.
  withLeading: {
    paddingLeft: space.hair,
    paddingRight: space.md + space.hair,
  },
  // A selected tag: plain white, flat (a shadow is the toolbar's and the assistant's lift).
  selected: {
    backgroundColor: colors.background.surface,
  },
  // Round, the frame's height wide.
  iconOnly: {
    width: chipFrame.minHeight,
    paddingHorizontal: 0,
    alignItems: 'center',
  },
  // The `lead` chip.
  accentFill: {
    backgroundColor: colors.accent.light,
  },
  raised: {
    backgroundColor: colors.background.surface,
  },
  // `raised` and `lead`.
  lifted: {
    ...shadows.raised,
  },
  // `add` and `mixed`.
  dashed: {
    borderColor: colors.border.dashed,
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
  detail: {
    color: colors.text.secondary,
  },
  accentLabel: {
    color: colors.accent.base,
  },
  leadLabel: {
    fontWeight: '600',
  },
});

// Each variant's own look, where it has one (`lead` is also `lifted`).
const VARIANT_STYLES: Partial<Record<ChipVariant, ViewStyle>> = {
  tag: styles.tag,
  lead: styles.accentFill,
  raised: styles.raised,
  add: styles.dashed,
  mixed: styles.dashed,
};
