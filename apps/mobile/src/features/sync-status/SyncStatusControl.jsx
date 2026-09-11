import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

import { useSyncStatus } from '@/sync/useSyncStatus';
import { requestSync } from '@/sync/worker';

// Minimal dev status surface for the metadata sync engine + a manual "Sync now"; keep it simple.
export default function SyncStatusControl() {
  const { phase, pendingCount, cursor, lastPullAt, lastError } = useSyncStatus();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sync (metadata)</Text>
      <Text style={styles.row}>phase: {phase}</Text>
      <Text style={styles.row}>pending: {pendingCount}</Text>
      <Text style={styles.row}>cursor: {cursor}</Text>
      {lastPullAt ? <Text style={styles.row}>last pull: {new Date(lastPullAt).toLocaleTimeString()}</Text> : null}
      {lastError ? <Text style={[styles.row, styles.error]}>error: {lastError}</Text> : null}
      <TouchableOpacity style={styles.button} onPress={() => requestSync()}>
        <Text style={styles.buttonText}>Sync now</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderColor: 'teal',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    gap: 4,
  },
  title: { fontWeight: '600', marginBottom: 4 },
  row: { fontVariant: ['tabular-nums'] },
  error: { color: 'red' },
  button: {
    marginTop: 8,
    backgroundColor: 'teal',
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  buttonText: { color: 'white', fontWeight: '600' },
});
