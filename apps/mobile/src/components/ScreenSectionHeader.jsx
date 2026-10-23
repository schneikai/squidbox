import { View, Text, StyleSheet } from 'react-native';

import { colors, typography } from '@/styles/designTokens';

/**
 * iOS-style uppercase section label used above grouped setting rows.
 * Shared by SettingsScreen, AiPromptsScreen, and any future list screens.
 *
 * When rightSlot is provided the component renders a flex row with the title
 * on the left and the slot on the right. Over cards it sits a little in from
 * their edge; `isFlush` lines it up with content that has no card around it.
 */
export default function ScreenSectionHeader({ title, rightSlot, isFlush = false }) {
  if (!rightSlot) {
    return <Text style={[styles.label, isFlush && styles.flush]}>{title}</Text>;
  }

  return (
    <View style={styles.row}>
      <Text style={[styles.labelInRow, isFlush && styles.flush]}>{title}</Text>
      {rightSlot}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: typography.body,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8,
    marginLeft: 4,
    marginTop: 20,
  },
  labelInRow: {
    flex: 1,
    fontSize: typography.body,
    fontWeight: '600',
    color: colors.textSecondary,
    marginLeft: 4,
  },
  flush: {
    marginLeft: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    marginTop: 20,
  },
});
