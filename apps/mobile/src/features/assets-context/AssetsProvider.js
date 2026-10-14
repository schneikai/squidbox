import { useMemo } from 'react';

import AssetsContext from './AssetsContext';

import * as repo from '@/sync/assetsRepository';
import { getDb, schema } from '@/sync/db/client';
import { deriveAssetPostHistory } from '@/sync/derive';
import { toAssetRecord, toAssetChanges } from '@/sync/legacyAsset';
import { useLiveCollectionMap, useLiveCollectionRows } from '@/sync/useCollection';
import { useDerivedRecords } from '@/sync/useDerivedRecords';
import { requestSync } from '@/sync/worker';
import { writeInBatches } from '@/sync/writeInBatches';

// Assets from SQLite with their derived post history; writes go through the repository and then
// start a sync. Only mounted after the initial pull finishes (see AppGate).
const NO_POSTS = [];

export default function AssetsProvider({ children }) {
  const assetRows = useLiveCollectionRows(schema.assets);
  const postEdges = useLiveCollectionRows(schema.postAssets);
  const posts = useLiveCollectionMap(schema.posts);

  // Derive postHistory/lastPostedAt (posts referencing each asset) onto the record shape.
  const postHistoryOf = useMemo(() => {
    const { historyById, lastPostedAtById } = deriveAssetPostHistory(posts, postEdges);
    return (row) => ({ postHistory: historyById[row.id] ?? NO_POSTS, lastPostedAt: lastPostedAtById[row.id] ?? null });
  }, [posts, postEdges]);
  const assets = useDerivedRecords(assetRows, postHistoryOf);

  const value = useMemo(
    () => ({
      assets,
      addAssetsAsync: async (list) => {
        const records = await repo.createAssets(getDb(), list.map(toAssetRecord));
        requestSync();
        return records;
      },
      updateAsset: async (id, updates) => {
        await repo.updateAsset(getDb(), id, toAssetChanges(updates));
        requestSync();
      },
      // Local-only marker for failed file uploads (never synced); null clears it for a retry.
      setAssetsSyncError: async (assetIds, error, batchOptions) => {
        await writeInBatches(assetIds, (ids) => repo.setSyncError(getDb(), ids, error), batchOptions);
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
    [assets],
  );

  return <AssetsContext.Provider value={value}>{children}</AssetsContext.Provider>;
}
