import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

export type ChipRowProps = { children?: ReactNode };

/** Chips side by side, wrapping onto more lines: a row of tags. */
export default function ChipRow({ children }: ChipRowProps) {
  return <View style={styles.row}>{children}</View>;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
