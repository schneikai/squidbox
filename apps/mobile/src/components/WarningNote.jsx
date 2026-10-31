import { Text as RNText, StyleSheet, View } from 'react-native';

import Icon from '@/components/Icon';
import { colors, lineHeights, radii, typography } from '@/styles/designTokens';

/**
 * A warning about what's on the screen, on a yellow note with an alert icon: something to fix that
 * doesn't stop the user (an instruction text without one of its placeholders). The parent positions
 * it through `style`.
 */
export default function WarningNote({ children, style }) {
  return (
    <View style={[styles.note, style]} accessibilityRole="alert">
      <Icon name="alert" size={18} color={colors.text.primary} style={styles.icon} />
      <RNText style={styles.text}>{children}</RNText>
    </View>
  );
}

const styles = StyleSheet.create({
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radii.card,
    backgroundColor: colors.background.note,
  },
  icon: {
    marginTop: 1,
  },
  text: {
    flex: 1,
    fontSize: typography.subheadline,
    lineHeight: lineHeights.subheadline,
    color: colors.text.primary,
  },
});
