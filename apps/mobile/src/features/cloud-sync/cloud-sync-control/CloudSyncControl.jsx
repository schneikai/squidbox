import { View, StyleSheet } from 'react-native';

import StatusIdle from './StatusIdle';
import StatusSyncing from './StatusSyncing';
import useCloudSync from '../useCloudSync';

export default function CloudSyncControl() {
  const { isSyncing } = useCloudSync();

  return (
    <View style={styles.container}>
      {isSyncing && <StatusSyncing />}
      {!isSyncing && <StatusIdle />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    borderColor: 'orange',
    borderWidth: 1,
    padding: 10,
    flexDirection: 'column',
    gap: 10,
  },
});
