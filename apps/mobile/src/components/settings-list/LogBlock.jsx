import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, radii, shadows, typography } from '@/styles/designTokens';

// A grouped-list "card" holding a fixed-height, internally-scrolling log (sync runs, backup runs).
// Matches the Section card look so it sits naturally in a Settings-style screen.
export function LogBlock({ children, maxHeight = 200 }) {
  return (
    <View style={styles.card}>
      <ScrollView style={{ maxHeight }} nestedScrollEnabled contentContainerStyle={styles.inner}>
        {children}
      </ScrollView>
    </View>
  );
}

export function LogLine({ primary, secondary, error }) {
  return (
    <View style={styles.entry}>
      <Text style={styles.primary}>{primary}</Text>
      {secondary ? <Text style={styles.secondary}>{secondary}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

export function LogEmpty({ text }) {
  return <Text style={styles.empty}>{text}</Text>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.glassSurface,
    borderRadius: radii.card,
    marginBottom: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
    ...shadows.section,
  },
  inner: { gap: 8 },
  entry: { gap: 1 },
  primary: { fontSize: typography.sm, color: colors.text, fontVariant: ['tabular-nums'] },
  secondary: { fontSize: typography.xs, color: colors.textSecondary },
  error: { fontSize: typography.xs, color: colors.danger },
  empty: { fontSize: typography.sm, color: colors.textTertiary },
});
