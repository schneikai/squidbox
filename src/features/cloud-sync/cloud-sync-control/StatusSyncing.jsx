import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

import useCloudSync from '../useCloudSync';

export default function StatusSyncing() {
  const { syncMessage, syncProgressMessage, syncSpeedMessage } = useCloudSync();
  const [expanded, setExpanded] = useState(false);

  return (
    <Pressable onPress={() => setExpanded((v) => !v)} style={styles.container}>
      <Text style={styles.title}>{syncMessage ?? 'Starting Sync...'}</Text>

      {expanded && syncProgressMessage && (
        <>
          <View style={styles.row}>
            <Text style={styles.label}>Progress</Text>
            <Text style={styles.value}>
              {syncProgressMessage.sent} of {syncProgressMessage.total}
              {'  '}
              <Text>{syncProgressMessage.percent}</Text>
            </Text>
          </View>

          {syncSpeedMessage && (
            <>
              <View style={styles.row}>
                <Text style={styles.label}>Bandwidth</Text>
                <Text style={styles.value}>{syncSpeedMessage.now}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Bandwidth Avg</Text>
                <Text style={styles.value}>{syncSpeedMessage.avg}</Text>
              </View>
            </>
          )}
        </>
      )}

      <Text style={styles.hint}>{expanded ? 'Tap to collapse' : 'Tap for details'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: 4,
  },
  title: {
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  label: {
    color: '#888',
  },
  value: {
    fontVariant: ['tabular-nums'],
  },
  muted: {
    color: '#888',
  },
  hint: {
    textAlign: 'center',
    fontSize: 11,
    color: '#aaa',
    marginTop: 2,
  },
});
