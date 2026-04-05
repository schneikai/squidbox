import { Text, StyleSheet } from 'react-native';

import { colors, typography } from '@/styles/designTokens';

/**
 * iOS-style uppercase section label used above grouped setting rows.
 * Shared by SettingsScreen, AiPromptsScreen, and any future list screens.
 */
export default function ScreenSectionHeader({ title }) {
  return <Text style={styles.label}>{title}</Text>;
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
});
