import { StyleSheet, Text, View } from 'react-native';

import { colors, radii, typography } from '@/styles/designTokens';

// Venice's own uncensored label on a model (the server derives it from the catalog).
export default function UncensoredBadge() {
  return (
    <View style={styles.badge}>
      <Text style={styles.label}>Uncensored</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: colors.accent.surface,
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  label: {
    fontSize: typography.caption,
    fontWeight: '600',
    color: colors.accent.base,
  },
});
