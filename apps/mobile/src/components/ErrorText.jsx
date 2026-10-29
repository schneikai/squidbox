import { StyleSheet, Text } from 'react-native';

import { colors, lineHeights, typography } from '@/styles/designTokens';

/** What went wrong, in red text: a failed reply, a missed turn, a sync error. `isSmall` for a line under another. */
export default function ErrorText({ isSmall = false, children }) {
  return <Text style={[styles.text, isSmall && styles.small]}>{children}</Text>;
}

const styles = StyleSheet.create({
  text: {
    fontSize: typography.subheadline,
    lineHeight: lineHeights.subheadline,
    color: colors.status.danger,
  },
  small: {
    fontSize: typography.footnote,
    lineHeight: lineHeights.footnote,
  },
});
