import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { Palette } from '@/components/Button';
import Icon, { type IconName } from '@/components/Icon';
import { colors, layout, radii, sizes, space, textStyles } from '@/styles/designTokens';

export type MenuItemContentProps = {
  label: string;
  icon?: IconName;
  leading?: ReactNode;
  disabled?: boolean;
  trailing?: ReactNode;
  colorPalette?: Extract<Palette, 'danger'>;
  isSelected?: boolean;
  isHeader?: boolean;
};

// A menu row's contents, iOS style: the label, `trailing` (a dot when `isSelected` and none is
// given), and the icon at the end. `leading` goes before the label where what the row picks has a
// mark of its own (a channel's logo); `disabled` greys the label. The row itself (height, padding, press feedback) belongs to
// MenuOption or the popover drawing it.
export default function MenuItemContent({
  label,
  icon,
  leading,
  disabled = false,
  trailing,
  colorPalette,
  isSelected = false,
  isHeader = false,
}: MenuItemContentProps) {
  const isDanger = colorPalette === 'danger';
  const iconColor = isDanger ? colors.status.danger : isSelected ? colors.accent.base : colors.text.primary;

  const iconNode = icon && (
    <Icon name={icon} size={sizes.menuItemIcon} color={iconColor} style={isHeader ? styles.headerIcon : styles.icon} />
  );

  // A header's icon (‹ back out of a panel) leads it; every other row's ends it.
  return (
    <>
      {isHeader && iconNode}
      {leading && <View style={styles.leading}>{leading}</View>}
      <Text
        style={[
          styles.label,
          isDanger && styles.labelDanger,
          isHeader && styles.labelHeader,
          disabled && styles.labelDisabled,
        ]}
      >
        {label}
      </Text>
      {trailing ?? (isSelected && <View style={styles.selectedDot} />)}
      {!isHeader && iconNode}
    </>
  );
}

const styles = StyleSheet.create({
  icon: {
    marginLeft: layout.menuIconGap,
  },
  headerIcon: {
    marginLeft: -space.xs,
    marginRight: layout.iconGap,
  },
  // Grows to push the trailing node right, but keeps its natural width as the basis: with `flex: 1`
  // (basis 0) the auto-sized menu ignores label widths, so long labels wrap after the menu's height
  // was measured and the last row is cut off.
  label: {
    flexGrow: 1,
    flexShrink: 1,
    ...textStyles.body,
    color: colors.text.primary,
  },
  labelDanger: {
    color: colors.status.danger,
  },
  labelHeader: textStyles.subheadlineBold,
  labelDisabled: {
    color: colors.text.tertiary,
  },
  leading: {
    marginRight: layout.iconGap,
  },
  selectedDot: {
    width: 7,
    height: 7,
    borderRadius: radii.pill,
    backgroundColor: colors.accent.base,
    marginLeft: space.sm,
  },
});
