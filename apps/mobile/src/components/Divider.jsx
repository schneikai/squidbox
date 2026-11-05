import { StyleSheet, View } from 'react-native';

import { colors, layout } from '@/styles/designTokens';

// The line between rows. `variant`: `list` (the default), a hairline between the rows of a grouped
// list, inset to the rows' text; `menuRow` a hairline across a popover menu between its rows; `menu`
// a wider grey band between groups of menu rows, e.g. a destructive action and the rest. style is
// for its place (e.g. pinned to a row's bottom edge).
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
  menuRow: {},
  menu: {
    height: 8,
    backgroundColor: colors.overlay.menuGap,
  },
});
