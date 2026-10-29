import { StyleSheet, Text, View } from 'react-native';

import Card from '@/components/Card';
import { colors, lineHeights, typography } from '@/styles/designTokens';

/**
 * One post the assistant wrote: its text, and under it the row of actions in `children` when given
 * (the chat's heart, More like this and Use or Copy); without them the text alone (a reply Verify
 * shows).
 */
export default function OptionCard({ text, children }) {
  const hasActions = children != null;

  return (
    <Card style={[styles.card, !hasActions && styles.textOnly]}>
      <Text style={styles.text} selectable>
        {text}
      </Text>
      {hasActions && <View style={styles.actions}>{children}</View>}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingTop: 14,
    paddingHorizontal: 16,
    paddingBottom: 4,
    gap: 4,
  },
  textOnly: {
    paddingBottom: 14,
  },
  text: {
    fontSize: typography.body,
    lineHeight: lineHeights.reading,
    color: colors.text.primary,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: -10,
  },
});
