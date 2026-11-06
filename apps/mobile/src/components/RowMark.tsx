import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { sizes } from '@/styles/designTokens';

/**
 * The marks at the end of a card's row that aren't buttons (the assistant's sparkle on a field it
 * filled, a duplicate's dot): centered in a 44 pt slot, the same slot a row's trailing icon button
 * takes (IconSlotContext), so a mark sits as far in from the card's edge as the button would.
 */
type RowMarkProps = { children: ReactNode };

export default function RowMark({ children }: RowMarkProps) {
  return <View style={styles.slot}>{children}</View>;
}

const styles = StyleSheet.create({
  slot: {
    minWidth: sizes.iconButton,
    minHeight: sizes.iconButton,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
});
