import { StyleSheet, View } from 'react-native';

import { colors, layout } from '@/styles/designTokens';

// The hairline between rows. `variant`: `list` (the default) between the rows of a grouped list,
// inset to the rows' text; `menu` between groups of menu rows, e.g. a destructive action and the
// rest. style is for its place (e.g. pinned to a row's bottom edge).
export default function Divider({ variant = 'list', style }) {
  return <View style={[styles.divider, styles[variant], style]} />;
}

const styles = StyleSheet.create({
  divider: {
    height: 1,
    backgroundColor: colors.border.divider,
  },
  list: {
    marginLeft: layout.sideGutter,
  },
  menu: {
    marginVertical: 4,
    marginHorizontal: 10,
  },
});
