import { StyleSheet, Text } from 'react-native';

import { colors, lineHeights, typography } from '@/styles/designTokens';

// The small grey text that says what a screen is for, or what to do on it, above its content, or a
// note beside it. The parent positions it through `style`; `selectable` lets the text be copied.
export default function IntroText({ children, style, selectable }) {
  return (
    <Text style={[styles.text, style]} selectable={selectable}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    fontSize: typography.footnote,
    lineHeight: lineHeights.footnote,
    color: colors.text.secondary,
  },
});
