import { Text } from 'react-native';

import StatusError from './StatusError';
import useCloudSync from '../useCloudSync';

import { Button } from '@/components/Buttons';

export default function StatusIdle() {
  const { unsyncedAssets, assetsWithSyncErrors, syncNow } = useCloudSync();

  return (
    <>
      {unsyncedAssets.length === 0 && assetsWithSyncErrors.length === 0 && (
        <Text>All assets are synced with the cloud!</Text>
      )}

      {unsyncedAssets.length > 0 && (
        <>
          <Text>You have {unsyncedAssets.length} unsynced assets.</Text>
          <Button onPress={syncNow} title="Sync Now" />
        </>
      )}

      <StatusError />
    </>
  );
}
