import { StyleSheet, Text, View } from 'react-native';

import Icon from '@/components/Icon';
import { colors, spacing } from '@/styles/designTokens';

// A menu row's contents: leading icon, label, and `trailing` (an ActiveDot when `active` and none is
// given). The row itself (padding, press feedback) belongs to MenuOption or the popover drawing it.
export default function MenuItemContent({ label, icon, trailing, danger = false, active = false, emphasized = false }) {
  const iconColor = danger ? colors.danger : active ? colors.accent : colors.menuTextDim;

  return (
    <>
      {icon && <Icon name={icon} size={spacing.menuIconSize} color={iconColor} style={styles.icon} />}
      <Text style={[styles.label, danger && styles.labelDanger, emphasized && styles.labelEmphasized]}>{label}</Text>
      {trailing ?? (active && <View style={styles.activeDot} />)}
    </>
  );
}

const styles = StyleSheet.create({
  icon: {
    marginRight: spacing.menuIconGap,
    width: spacing.menuIconSize,
  },
  // Grows to push the trailing node right, but keeps its natural width as the basis: with `flex: 1`
  // (basis 0) the auto-sized menu ignores label widths, so long labels wrap after the menu's height
  // was measured and the last row is cut off.
  label: {
    flexGrow: 1,
    flexShrink: 1,
    fontSize: spacing.menuFontSize,
    fontWeight: '500',
    color: colors.menuText,
  },
  labelDanger: {
    color: colors.danger,
  },
  labelEmphasized: {
    fontWeight: '600',
  },
  activeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.accent,
    marginLeft: 8,
  },
});
