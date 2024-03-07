import { Text } from 'react-native';

import useCloudSync from '../useCloudSync';

export default function StatusSyncing() {
  const { syncMessage } = useCloudSync();

  return <Text>{syncMessage ? syncMessage : 'Starting Sync...'}</Text>;
}
