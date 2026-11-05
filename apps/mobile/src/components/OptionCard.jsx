import { StyleSheet, View } from 'react-native';

import Card from '@/components/Card';
import Text from '@/components/Text';
import { layout, space } from '@/styles/designTokens';

/**
 * One post the assistant wrote: its text, and under it the row of actions in `children` when given
 * (the chat's heart, More like this and Use or Copy); without them the text alone (a reply Verify
 * shows).
 */
export default function OptionCard({ text, children }) {
  const hasActions = children != null;

  return (
    <Card style={[styles.card, !hasActions && styles.textOnly]}>
      <Text selectable>{text}</Text>
      {hasActions && <View style={styles.actions}>{children}</View>}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingTop: layout.cardInset,
    paddingHorizontal: layout.cardInset,
    paddingBottom: space.xs,
    gap: space.xs,
  },
  textOnly: {
    paddingBottom: layout.cardInset,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    // eslint-disable-next-line no-restricted-syntax -- pulls the first icon button's glyph to the text's edge
    marginLeft: -10,
  },
});
