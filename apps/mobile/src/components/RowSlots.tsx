import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import Icon from '@/components/Icon';
import { LIST_INDICATOR_SIZE } from '@/components/SelectIndicator';
import { colors, layout, sizes, space } from '@/styles/designTokens';

export type RowSlotsProps = {
  leading?: ReactNode;
  isSelected?: boolean;
  children: ReactNode;
  value?: ReactNode;
  trailing?: ReactNode;
  hasChevron?: boolean;
  size?: 'regular' | 'small';
};

/**
 * The three slots every list row is laid out in, so rows look and end alike wherever they are
 * built (Row in a section card, ContactRow in a long list): `leading` (an icon, an avatar), the text
 * (`children`, taking the room left) and the end: a `value` and then `trailing` (avatars, a button,
 * a selection circle). `hasChevron` ends a row that opens a screen with a chevron, but only while
 * nothing is at its end: `trailing` takes its place, a `value` keeps it beside it. `isSelected` makes
 * it a row of a pick-one list: the accent check in front when it is the current one, an empty slot as
 * wide as SelectIndicator's circle when not, so the text lines up as in a pick-several list.
 * `size="small"` is the tighter row of a long list. Layout only: the parent draws the press, the card
 * and the dividers.
 */
export default function RowSlots({
  leading,
  isSelected,
  children,
  value,
  trailing,
  hasChevron = false,
  size = 'regular',
}: RowSlotsProps) {
  const hasTrailing = trailing != null && trailing !== false;
  const hasValue = value != null && value !== false;

  return (
    <View style={[styles.row, size === 'small' && styles.small]}>
      {(leading != null || isSelected !== undefined) && (
        <View style={styles.leading}>
          {isSelected !== undefined && (
            <View style={styles.pickSlot}>
              {isSelected && <Icon name="check" size={sizes.icon} color={colors.accent.base} />}
            </View>
          )}
          {leading}
        </View>
      )}
      <View style={hasValue ? styles.textKept : styles.text}>{children}</View>
      {(hasValue || hasTrailing || hasChevron) && (
        <View style={[styles.tail, hasValue && styles.tailFilling]}>
          {value}
          {trailing}
          {hasChevron && !hasTrailing && (
            <Icon
              name="chevron-right"
              size={sizes.iconSmall}
              color={colors.text.tertiary}
              style={hasValue && styles.chevronAfterValue}
            />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: sizes.iconButton,
    paddingHorizontal: layout.rowInset,
    paddingVertical: layout.rowPaddingY,
  },
  small: {
    paddingVertical: layout.rowPaddingYCompact,
  },
  leading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.rowLeadingGap,
    marginRight: layout.rowLeadingGap,
  },
  pickSlot: {
    width: LIST_INDICATOR_SIZE,
    alignItems: 'center',
  },
  text: {
    flex: 1,
    gap: space.hair,
  },
  // With a value the text takes its own width and the value the rest, so a long one wraps
  // instead of squeezing the label away.
  textKept: {
    gap: space.hair,
    flexShrink: 0,
  },
  tail: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    marginLeft: space.sm,
  },
  tailFilling: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  // A value's chevron a little apart from it; a bare label's sits at the end's gap.
  chevronAfterValue: {
    marginLeft: space.xs,
  },
});
