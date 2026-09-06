import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { useMemo } from 'react';

import AssetsContext from './AssetsContext';

import { getDb } from '@/sync/db/client';
import migrations from '@/sync/db/migrations/migrations';
import * as repo from '@/sync/assetsRepository';
import { toAssetRecord, toAssetChanges } from '@/sync/legacyAsset';
import { useLiveAssetsMap } from '@/sync/useAssetsQuery';
import { requestSync } from '@/sync/worker';

// Modern asset store: SQLite (the source of truth) + the sync engine, exposed through the same
// provider API the app already consumes (an id-keyed `assets` map + methods). Reads are reactive
// via useLiveQuery; writes go through the transactional repository (row + outbox) and then kick
// the sync worker. No JSON blobs, no useNewSync flag — this replaces the old path outright.
export default function AssetsProvider({ children }) {
  const { success, error } = useMigrations(getDb(), migrations);
  if (error) throw error; // fail loudly in dev — the DB must migrate before use
  if (!success) return null; // brief: first-launch migration
  return <AssetsData>{children}</AssetsData>;
}

function AssetsData({ children }) {
  const assets = useLiveAssetsMap();

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
        // Tombstone the metadata; it syncs as a delete. TODO(2b polish): also delete the S3
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
