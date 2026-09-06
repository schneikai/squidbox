import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';

import SyncErrorViewer from './SyncErrorViewer';
import useCloudSync from '../useCloudSync';

import useAssets from '@/features/assets-context/useAssets';

export default function SyncErrorStatus() {
  const { assetsWithSyncErrors } = useCloudSync();
  const { updateAssets } = useAssets();
  const [syncErrorViewerVisible, setSyncErrorViewerVisible] = useState(false);

  if (assetsWithSyncErrors.length === 0) {
    return null;
  }

  async function handleRetry() {
    const assetIds = assetsWithSyncErrors.map((asset) => asset.id);
    await updateAssets(assetIds, { syncError: null });
  }

  return (
    <>
      <Text>You have {assetsWithSyncErrors.length} assets with sync errors.</Text>

      <View style={{ flexDirection: 'row', gap: 4 }}>
        <Pressable onPress={() => setSyncErrorViewerVisible(true)}>
          <Text style={{ fontWeight: 'bold', color: 'blue' }}>Show</Text>
        </Pressable>

        <Pressable onPress={handleRetry}>
          <Text style={{ fontWeight: 'bold', color: 'blue' }}>Retry</Text>
        </Pressable>
      </View>

      {syncErrorViewerVisible && (
        <SyncErrorViewer assetsWithSyncErrors={assetsWithSyncErrors} close={() => setSyncErrorViewerVisible(false)} />
      )}
    </>
  );
}
