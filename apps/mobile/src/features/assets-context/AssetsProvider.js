import { useMemo } from 'react';

import AssetsContext from './AssetsContext';

import * as repo from '@/sync/assetsRepository';
import { getDb } from '@/sync/db/client';
import { toAssetRecord, toAssetChanges } from '@/sync/legacyAsset';
import { requestSync } from '@/sync/worker';
import { writeInBatches } from '@/sync/writeInBatches';

// The asset writes: each goes through the repository and then starts a sync. Screens read assets
// through their own live queries (assetQuery, readByIds).
export default function AssetsProvider({ children }) {
  const value = useMemo(
    () => ({
      addAssetsAsync: async (list) => {
        const records = await repo.createAssets(getDb(), list.map(toAssetRecord));
        requestSync();
        return records;
      },
      updateAsset: async (id, updates) => {
        await repo.updateAsset(getDb(), id, toAssetChanges(updates));
        requestSync();
      },
      // Local-only marker for failed file uploads (never synced); clearing them all retries every upload.
      setAssetsSyncError: async (assetIds, error) => {
        await repo.setSyncError(getDb(), assetIds, error);
      },
      clearSyncErrors: async () => {
        await repo.clearSyncErrors(getDb());
      },
      toggleFavoriteAsset: async (asset) => {
        await repo.toggleFavorite(getDb(), asset.id);
        requestSync();
      },
      // The bulk methods take the batch options of writeInBatches ({ onProgress, isCancelled }).
      setAssetsDeleted: async (assetIds, batchOptions) => {
        await writeInBatches(assetIds, (ids) => repo.deleteAssets(getDb(), ids), batchOptions);
        requestSync();
      },
      restoreDeletedAssets: async (assetIds, batchOptions) => {
        await writeInBatches(assetIds, (ids) => repo.updateAllAssets(getDb(), ids, { deletedAt: null }), batchOptions);
        requestSync();
      },
      deleteAssetsAsync: async (assetIds, batchOptions) => {
        // Tombstone the metadata; it syncs as a delete. TODO: also delete the S3
        // binaries via the new backend before tombstoning (sync-design §7a).
        await writeInBatches(assetIds, (ids) => repo.deleteAssets(getDb(), ids), batchOptions);
        requestSync();
      },
    }),
    [],
  );

  return <AssetsContext.Provider value={value}>{children}</AssetsContext.Provider>;
}
