import { StyleSheet, Text } from 'react-native';

import { colors, lineHeights, typography } from '@/styles/designTokens';

/** A post's text, to read: one the assistant wrote, a Verify post's caption. `selectable` lets it be copied. */
export default function PostText({ children, selectable }) {
  return (
    <Text style={styles.text} selectable={selectable}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    fontSize: typography.body,
    lineHeight: lineHeights.reading,
    color: colors.text.primary,
  },
});
