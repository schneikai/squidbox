import { StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/styles/designTokens';

// The hairline between the rows of a grouped list, inset to the rows' text. style is for its place
// (e.g. pinned to a row's bottom edge).
export default function ListDivider({ style }) {
  return <View style={[styles.divider, style]} />;
}

const styles = StyleSheet.create({
  divider: {
    height: 1,
    backgroundColor: colors.divider,
    marginLeft: spacing.floatingBarSide,
  },
});
