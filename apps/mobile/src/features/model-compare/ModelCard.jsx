import { ActivityIndicator, StyleSheet, View } from 'react-native';

import BlindModelName from './BlindModelName';
import UncensoredToggle from './UncensoredToggle';

import Card from '@/components/Card';
import Text from '@/components/Text';
import { colors } from '@/styles/designTokens';

/**
 * One model's answer in a blind compare: its letter with the eye for its name, its Uncensored
 * toggle, and `children` (the tweets or tags) once `result` is done; a spinner while loading, the
 * error when it failed. No counts: they would give the model away.
 */
export default function ModelCard({ modelId, label, name, result, children }) {
  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <BlindModelName label={label} name={name} />
        <UncensoredToggle modelId={modelId} label={label} />
      </View>
      {result?.status === 'done' && children}
      {result?.status === 'loading' && <ActivityIndicator style={styles.loading} color={colors.text.secondary} />}
      {result?.status === 'error' && <Text variant="error">{result.error}</Text>}
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
  loading: {
    paddingVertical: 16,
  },
});
