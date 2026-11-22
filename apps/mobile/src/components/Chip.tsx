import { type ReactNode, useContext } from 'react';
import { Pressable, type PressableProps, type StyleProp, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import Icon, { type IconName } from '@/components/Icon';
import InkContext from '@/components/InkContext';
import chipFrame from '@/styles/chipFrame';
import { colors, disabledOpacity, layout, press, sizes, space, textStyles } from '@/styles/designTokens';

export type ChipVariant = 'tag' | 'add' | 'mixed';

export type ChipProps = Pick<
  PressableProps,
  'onPress' | 'disabled' | 'accessibilityRole' | 'accessibilityLabel' | 'accessibilityHint'
> & {
  label: string;
  detail?: string;
  variant?: ChipVariant;
  icon?: IconName;
  leading?: ReactNode;
  onRemove?: () => void;
  removeLabel?: string;
  isSelected?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * A pill with a short label. `variant` says what it is: `tag` (the default: a thing, such as a tag
 * or a contact, grey on white or on the page; plain white when it `isSelected`, a toggle that is on), `add` (the grey dashed Add at the
 * end of a row, with its plus) or `mixed` (a tag on only some of the items, such as an album's
 * photos: no fill and a dashed outline; VoiceOver reads it as mixed). Every variant has the same
 * frame, so a tag tapped on never changes its width and moves the chips after it.
 *
 * icon — leads the label (Icon name), grey; `leading` leads it instead with a node
 * (a contact's chip avatar, sizes.avatar.chip) and the label stays on one line, cut short when the
 * chip would be wider than its row. `isSelected` tells VoiceOver it's on (as checked when
 * `accessibilityRole` is a checkbox). `disabled` dims it and takes no presses. Without
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
  const ink = useContext(InkContext);
  const leadingIcon = variant === 'add' ? 'add' : icon;
  const frame = [
    chipFrame,
    styles.chip,
    // A tag's fill is see-through (the ink's), a shade darker than what it sits on; add and mixed are dashed.
    variant === 'tag' ? { backgroundColor: ink.fill } : styles.dashed,
    variant === 'tag' && isSelected && styles.selected,
    !!leading && styles.withLeading,
  ];
  const accessibilityState =
    accessibilityRole === 'checkbox' ? { checked: isSelected, disabled } : { selected: isSelected, disabled };
  // A `mixed` tag reads as mixed, in the app and the web build alike (aria-checked reaches both).
  const ariaChecked = variant === 'mixed' ? ('mixed' as const) : undefined;
  const content = (
    <>
      {leading ?? (leadingIcon && <Icon name={leadingIcon} size={sizes.menuIcon} color={ink.secondary} />)}
      <Text style={[styles.label, styles.shrinks, { color: ink.primary }]} numberOfLines={leading ? 1 : undefined}>
        {label}
        {detail ? <Text style={{ color: ink.secondary }}>{` · ${detail}`}</Text> : null}
      </Text>
    </>
  );

  const remove = onRemove && (
    <Pressable
      onPress={onRemove}
      disabled={disabled}
      hitSlop={space.sm}
      accessibilityRole="button"
      accessibilityLabel={removeLabel}
      style={({ pressed }) => [styles.remove, pressed && press.flat]}
    >
      <Icon name="close" size={sizes.menuIcon} color={ink.secondary} />
    </Pressable>
  );

  if (!onPress && !remove) {
    return (
      <View
        accessibilityLabel={accessibilityLabel}
        aria-checked={ariaChecked}
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
            accessibilityLabel={accessibilityLabel}
            accessibilityHint={accessibilityHint}
            style={({ pressed }) => [styles.chip, styles.shrinks, pressed && press.flat]}
          >
            {content}
          </Pressable>
        ) : (
          <View
            accessibilityLabel={accessibilityLabel}
            aria-checked={ariaChecked}
            style={[styles.chip, styles.shrinks]}
          >
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
  // The node sits close to the frame's start, as an avatar in a pill does.
  withLeading: {
    paddingLeft: space.hair,
    paddingRight: space.md + space.hair,
  },
  // A selected tag: plain white with a hairline edge, flat.
  selected: {
    backgroundColor: colors.background.surface,
    borderColor: colors.border.divider, // its edge on a white card, where the white fill alone vanishes
  },
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
  // Its color is the ink's (InkContext).
  label: textStyles.subheadline,
});
