import { Text as RNText, StyleSheet } from 'react-native';

import Text from '@/components/Text';
import { layout } from '@/styles/designTokens';

// The small grey text that says what a screen is for, or what to do on it, above its content, or a
// note beside it. `isScreenIntro` is a screen's intro at the top of its content: a little in from the
// cards' edge, with the gap every screen's intro has to what follows it. Otherwise the parent
// positions it through `style`. `label` leads the line in bold ("Sees coastline, tent"); `selectable`
// lets the text be copied, `numberOfLines` cuts a long one short, and `accessibilityLabel` is
// what a screen reader says instead.
export default function IntroText({
  children,
  label,
  isScreenIntro = false,
  style,
  selectable,
  numberOfLines,
  accessibilityLabel,
}) {
  return (
    <Text
      variant="hint"
      style={[isScreenIntro && styles.screenIntro, style]}
      selectable={selectable}
      numberOfLines={numberOfLines}
      accessibilityLabel={accessibilityLabel}
    >
      {label != null && <RNText style={styles.label}>{label} </RNText>}
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  label: {
    fontWeight: '600',
  },
  screenIntro: {
    marginHorizontal: 4,
    marginBottom: layout.introGap,
  },
});
