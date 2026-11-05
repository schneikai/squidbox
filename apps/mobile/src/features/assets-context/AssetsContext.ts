import type { AssetRecord } from '@squidbox/shared';
import { createContext } from 'react';

import type { BatchOptions } from '@/sync/writeInBatches';

// The asset writes (AssetsProvider). The bulk methods take writeInBatches' options and resolve to
// whether every batch was written.
export type AssetsContextValue = {
  addAssetsAsync: (list: AssetRecord[]) => Promise<AssetRecord[]>;
  updateAsset: (id: string, updates: Partial<AssetRecord>) => Promise<void>;
  setAssetsSyncError: (assetIds: string[], error: string | null) => Promise<void>;
  clearSyncErrors: () => Promise<void>;
  toggleFavoriteAsset: (asset: Pick<AssetRecord, 'id'>) => Promise<void>;
  setAssetsDeleted: (assetIds: string[], batchOptions?: BatchOptions) => Promise<boolean>;
  restoreDeletedAssets: (assetIds: string[], batchOptions?: BatchOptions) => Promise<boolean>;
  deleteAssetsPermanently: (assetIds: string[], batchOptions?: BatchOptions) => Promise<boolean>;
};

const AssetsContext = createContext<AssetsContextValue | null>(null);

export default AssetsContext;
