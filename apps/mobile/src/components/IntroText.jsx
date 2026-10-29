import { StyleSheet, Text } from 'react-native';

import { colors, layout, lineHeights, typography } from '@/styles/designTokens';

// The small grey text that says what a screen is for, or what to do on it, above its content, or a
// note beside it. `isScreenIntro` is a screen's intro at the top of its content: a little in from the
// cards' edge, with the gap every screen's intro has to what follows it. Otherwise the parent
// positions it through `style`. `label` leads the line in bold ("Sees coastline, tent"); `selectable`
// lets the text be copied, and `numberOfLines` cuts a long one short.
export default function IntroText({ children, label, isScreenIntro = false, style, selectable, numberOfLines }) {
  return (
    <Text
      style={[styles.text, isScreenIntro && styles.screenIntro, style]}
      selectable={selectable}
      numberOfLines={numberOfLines}
    >
      {label != null && <Text style={styles.label}>{label} </Text>}
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
  label: {
    fontWeight: '600',
  },
  screenIntro: {
    marginHorizontal: 4,
    marginBottom: layout.introGap,
  },
});
