import { StyleSheet, Text } from 'react-native';

import { colors, lineHeights, typography } from '@/styles/designTokens';

// The small grey text that says what a screen is for, or what to do on it, above its content, or a
// note beside it. The parent positions it through `style`; `selectable` lets the text be copied, and
// `numberOfLines` cuts a long one short.
export default function IntroText({ children, style, selectable, numberOfLines }) {
  return (
    <Text style={[styles.text, style]} selectable={selectable} numberOfLines={numberOfLines}>
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
