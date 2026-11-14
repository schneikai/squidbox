import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { Palette } from '@/components/Button';
import Icon, { type IconName } from '@/components/Icon';
import SelectIndicator from '@/components/SelectIndicator';
import { colors, layout, sizes, space, textStyles } from '@/styles/designTokens';

export type MenuItemContentProps = {
  label: string;
  icon?: IconName;
  leading?: ReactNode;
  trailing?: ReactNode;
  colorPalette?: Extract<Palette, 'danger'>;
  isSelected?: boolean;
  selection?: 'one' | 'several';
  isHeader?: boolean;
};

// A menu row's contents, iOS style: the label, `trailing`, and the icon at the end. A row of a
// pick-one menu (`selection="one"`, the default) shows the selection check (colors.selection) when
// `isSelected`; a row of a pick-several menu (`selection="several"`) always shows a select circle
// (SelectIndicator), filled when `isSelected`.
// A given `trailing` takes the mark's place. `leading` goes before the label where what the row picks
// has a mark of its own (a channel's logo). The row itself (height, padding, press feedback, the
// dimming of a disabled one) belongs to MenuOption or the popover drawing it.
export default function MenuItemContent({
  label,
  icon,
  leading,
  trailing,
  colorPalette,
  isSelected = false,
  selection = 'one',
  isHeader = false,
}: MenuItemContentProps) {
  const isDanger = colorPalette === 'danger';
  const iconColor = isDanger ? colors.status.danger : colors.text.primary;
  const mark =
    selection === 'several' ? (
      <SelectIndicator isSelected={isSelected} style={styles.mark} />
    ) : (
      isSelected && <Icon name="check" size={sizes.menuItemIcon} color={colors.selection.mark} style={styles.mark} />
    );

  const iconNode = icon && (
    <Icon name={icon} size={sizes.menuItemIcon} color={iconColor} style={isHeader ? styles.headerIcon : styles.icon} />
  );

  // A header's icon (‹ back out of a panel) leads it; every other row's ends it.
  return (
    <>
      {isHeader && iconNode}
      {leading && <View style={styles.leading}>{leading}</View>}
      <Text style={[styles.label, isDanger && styles.labelDanger, isHeader && styles.labelHeader]}>{label}</Text>
      {trailing ?? mark}
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
  leading: {
    marginRight: layout.iconGap,
  },
  mark: {
    marginLeft: space.sm,
  },
});
