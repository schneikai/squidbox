import type { ReactNode } from 'react';
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import Card from '@/components/Card';
import Text from '@/components/Text';

export type OptionCardProps = { text: string; children?: ReactNode; style?: StyleProp<ViewStyle> };

/**
 * One post the assistant wrote: its text, and under it the row of actions in `children` when given
 * (the chat's More like this and Use or Copy); without them the text alone (a reply Verify shows).
 * It fills the height its parent gives it, the actions at its end, so the cards of one row line up
 * (a carousel of ideas). style is for layout only.
 */
export default function OptionCard({ text, children, style }: OptionCardProps) {
  const hasActions = children != null;

  return (
    <Card padded hasControlRow={hasActions} style={style}>
      <Text selectable>{text}</Text>
      {hasActions && <View style={styles.actions}>{children}</View>}
    </Card>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 'auto',
    // eslint-disable-next-line no-restricted-syntax -- pulls the first icon button's glyph to the text's edge
    marginLeft: -10,
  },
});
