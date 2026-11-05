import { StyleSheet, View } from 'react-native';

import { space } from '@/styles/designTokens';

/** Chips side by side, wrapping onto more lines: a row of tags. */
export default function ChipRow({ children }) {
  return <View style={styles.row}>{children}</View>;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
});
