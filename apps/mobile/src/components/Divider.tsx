import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, layout, space } from '@/styles/designTokens';

type DividerProps = { variant?: 'list' | 'menu'; style?: StyleProp<ViewStyle> };

// The hairline between rows. `variant`: `list` (the default) between the rows of a grouped list,
// inset to the rows' text; `menu` between groups of menu rows, e.g. a destructive action and the
// rest. style is for its place (e.g. pinned to a row's bottom edge).
export default function Divider({ variant = 'list', style }: DividerProps) {
  return <View style={[styles.divider, styles[variant], style]} />;
}

const styles = StyleSheet.create({
  divider: {
    height: 1,
    backgroundColor: colors.border.divider,
  },
  list: {
    marginLeft: layout.rowInset,
  },
  menu: {
    marginVertical: space.xs,
    marginHorizontal: layout.menuRowPaddingX, // under the rows' icons
  },
});
