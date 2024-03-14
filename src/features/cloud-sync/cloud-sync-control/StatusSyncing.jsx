import { Text } from 'react-native';

import useCloudSync from '../useCloudSync';

export default function StatusSyncing() {
  const { syncMessage, syncProgressMessage } = useCloudSync();

  return (
    <>
      <Text>{syncMessage ? syncMessage : 'Starting Sync...'}</Text>
      {syncProgressMessage && <Text>{syncProgressMessage}</Text>}
    </>
  );
}
