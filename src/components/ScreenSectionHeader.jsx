import { View, Text, StyleSheet } from 'react-native';

import { colors, typography } from '@/styles/designTokens';

/**
 * iOS-style uppercase section label used above grouped setting rows.
 * Shared by SettingsScreen, AiPromptsScreen, and any future list screens.
 *
 * When rightSlot is provided the component renders a flex row with the title
 * on the left and the slot on the right. Existing callers that pass only title
 * are unaffected.
 */
export default function ScreenSectionHeader({ title, rightSlot }) {
  if (!rightSlot) {
    return <Text style={styles.label}>{title}</Text>;
  }

  return (
    <View style={styles.row}>
      <Text style={styles.labelInRow}>{title}</Text>
      {rightSlot}
    </View>
  );
}

export const styles = StyleSheet.create({
  label: {
    fontSize: typography.base,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8,
    marginLeft: 4,
    marginTop: 20,
  },
  labelInRow: {
    flex: 1,
    fontSize: typography.base,
    fontWeight: '600',
    color: colors.textSecondary,
    marginLeft: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    marginTop: 20,
  },
});
