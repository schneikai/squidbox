import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import BlindModelName from './BlindModelName';

import Card from '@/components/Card';
import { colors, lineHeights, typography } from '@/styles/designTokens';

/**
 * One model's answer in a blind compare: its letter, its blurred name, and `children` (the tweets
 * or tags) once `result` is done; a spinner while loading, the error when it failed. No counts: they
 * would give the model away.
 */
export default function ModelCard({ label, name, result, children }) {
  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        <BlindModelName name={name} />
      </View>
      {result?.status === 'done' && children}
      {result?.status === 'loading' && <ActivityIndicator style={styles.loading} color={colors.text.secondary} />}
      {result?.status === 'error' && <Text style={styles.error}>{result.error}</Text>}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 14,
    gap: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  label: {
    flexShrink: 0,
    fontSize: typography.callout,
    fontWeight: '600',
    color: colors.text.primary,
  },
  loading: {
    paddingVertical: 16,
  },
  error: {
    fontSize: typography.subheadline,
    lineHeight: lineHeights.subheadline,
    color: colors.status.danger,
  },
});
