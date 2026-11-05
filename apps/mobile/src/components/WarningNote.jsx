import { Text as RNText, StyleSheet, View } from 'react-native';

import Icon from '@/components/Icon';
import { colors, layout, lineHeights, radii, space, textStyles } from '@/styles/designTokens';

const ICON_SIZE = 18;

/**
 * A warning about what's on the screen, on a yellow note with an alert icon: something to fix that
 * doesn't stop the user (an instruction text without one of its placeholders). The parent positions
 * it through `style`.
 */
export default function WarningNote({ children, style }) {
  return (
    <View style={[styles.note, style]} accessibilityRole="alert">
      <Icon name="alert" size={ICON_SIZE} color={colors.text.primary} style={styles.icon} />
      <RNText style={styles.text}>{children}</RNText>
    </View>
  );
}

const styles = StyleSheet.create({
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
    paddingHorizontal: layout.cardInset,
    paddingVertical: space.md,
    borderRadius: radii.card,
    backgroundColor: colors.background.note,
  },
  icon: {
    marginTop: (lineHeights.subheadline - ICON_SIZE) / 2, // centred on the text's first line
  },
  text: {
    flex: 1,
    ...textStyles.subheadline,
    color: colors.text.primary,
  },
});
