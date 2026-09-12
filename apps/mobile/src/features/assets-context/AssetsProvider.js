import { useMemo } from 'react';

import AssetsContext from './AssetsContext';

import * as repo from '@/sync/assetsRepository';
import { getDb, schema } from '@/sync/db/client';
import { deriveAssetPostHistory } from '@/sync/derive';
import { toAssetRecord, toAssetChanges } from '@/sync/legacyAsset';
import { useLiveAssetsMap } from '@/sync/useAssetsQuery';
import { useLiveCollectionMap, useLiveCollectionRows } from '@/sync/useCollection';
import { requestSync } from '@/sync/worker';

// Modern asset store: SQLite (the source of truth) + the sync engine, exposed through the same
// provider API the app already consumes (an id-keyed `assets` map + methods). Reads are reactive
// via useLiveQuery; writes go through the transactional repository (row + outbox) and then kick
// the sync worker. SQLite + the sync engine are the only path — no JSON blobs. This provider is only
// mounted after the initial pull finishes (see AppGate), so it always reads the full library.
export default function AssetsProvider({ children }) {
  const assetRows = useLiveAssetsMap();
  const postEdges = useLiveCollectionRows(schema.postAssets);
  const posts = useLiveCollectionMap(schema.posts);

  // Derive postHistory/lastPostedAt (posts referencing each asset) onto the record shape.
  const assets = useMemo(() => {
    const { historyById, lastPostedAtById } = deriveAssetPostHistory(posts, postEdges);
    const out = {};
    for (const [id, row] of Object.entries(assetRows)) {
      out[id] = { ...row, postHistory: historyById[id] ?? [], lastPostedAt: lastPostedAtById[id] ?? null };
    }
    return out;
  }, [assetRows, posts, postEdges]);

  const value = useMemo(
    () => ({
      assets,
      // SQLite + the live query hydrate automatically; kept for API compatibility.
      loadAssetsAsync: async () => {},
      addAssetAsync: async (data) => {
        const record = await repo.createAsset(getDb(), toAssetRecord(data));
        requestSync();
        return record;
      },
      addAssetsAsync: async (data) => {
        const list = Array.isArray(data) ? data : [data];
        const out = [];
        for (const item of list) out.push(await repo.createAsset(getDb(), toAssetRecord(item)));
        requestSync();
        return out;
      },
      updateAsset: async (id, updates) => {
        await repo.updateAsset(getDb(), id, toAssetChanges(updates));
        requestSync();
      },
      updateAssets: async (ids, updates) => {
        for (const id of ids) await repo.updateAsset(getDb(), id, toAssetChanges(updates));
        requestSync();
      },
      updateManyAssets: async (updatesById) => {
        for (const [id, updates] of Object.entries(updatesById)) {
          await repo.updateAsset(getDb(), id, toAssetChanges(updates));
        }
        requestSync();
      },
      toggleFavoriteAsset: async (asset) => {
        await repo.toggleFavorite(getDb(), asset.id);
        requestSync();
      },
      setAssetsDeleted: async (assetIds) => {
        await repo.deleteAssets(getDb(), assetIds);
        requestSync();
      },
      restoreDeletedAssets: async (assetIds) => {
        for (const id of assetIds) await repo.updateAsset(getDb(), id, { deletedAt: null });
        requestSync();
      },
      deleteAssetsAsync: async (assetsToDelete) => {
        // Tombstone the metadata; it syncs as a delete. TODO: also delete the S3
        // binaries via the new backend before tombstoning (sync-design §7a).
        await repo.deleteAssets(
          getDb(),
          assetsToDelete.map((asset) => asset.id),
        );
        requestSync();
      },
    }),
    [assets],
  );

  return <AssetsContext.Provider value={value}>{children}</AssetsContext.Provider>;
}
