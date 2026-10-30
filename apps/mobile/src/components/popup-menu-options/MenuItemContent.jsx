import { StyleSheet, Text, View } from 'react-native';

import Icon from '@/components/Icon';
import { colors, layout, radii, sizes, typography } from '@/styles/designTokens';

// A menu row's contents: leading icon, label, and `trailing` (a dot when `isSelected` and none is
// given). The row itself (padding, press feedback) belongs to MenuOption or the popover drawing it.
export default function MenuItemContent({ label, icon, trailing, colorPalette, isSelected = false, isHeader = false }) {
  const isDanger = colorPalette === 'danger';
  const iconColor = isDanger ? colors.status.danger : isSelected ? colors.accent.base : colors.text.secondary;

  return (
    <>
      {icon && <Icon name={icon} size={sizes.menuIcon} color={iconColor} style={styles.icon} />}
      <Text style={[styles.label, isDanger && styles.labelDanger, isHeader && styles.labelHeader]}>{label}</Text>
      {trailing ?? (isSelected && <View style={styles.selectedDot} />)}
    </>
  );
}

const styles = StyleSheet.create({
  icon: {
    marginRight: layout.menuIconGap,
    width: sizes.menuIcon,
  },
  // Grows to push the trailing node right, but keeps its natural width as the basis: with `flex: 1`
  // (basis 0) the auto-sized menu ignores label widths, so long labels wrap after the menu's height
  // was measured and the last row is cut off.
  label: {
    flexGrow: 1,
    flexShrink: 1,
    fontSize: typography.subheadline,
    fontWeight: '500',
    color: colors.text.primary,
  },
  labelDanger: {
    color: colors.status.danger,
  },
  labelHeader: {
    fontWeight: '600',
  },
  selectedDot: {
    width: 7,
    height: 7,
    borderRadius: radii.pill,
    backgroundColor: colors.accent.base,
    marginLeft: 8,
  },
});
