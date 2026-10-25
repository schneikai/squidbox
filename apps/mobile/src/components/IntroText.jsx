import { StyleSheet, Text } from 'react-native';

import { colors, lineHeights, typography } from '@/styles/designTokens';

// The small grey text that says what a screen is for, or what to do on it, above its content. The
// parent positions it through `style`.
export default function IntroText({ children, style }) {
  return <Text style={[styles.text, style]}>{children}</Text>;
}

const styles = StyleSheet.create({
  text: {
    fontSize: typography.footnote,
    lineHeight: lineHeights.footnote,
    color: colors.text.secondary,
  },
});
