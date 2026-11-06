import { createContext } from 'react';

import type { AssetExclude } from '@/features/asset-list/assetQuery';
import type { AssetRow } from '@/sync/db/schema';

export type AssetPickerValue = {
  openAssetPicker: (options?: { exclude?: AssetExclude }) => Promise<AssetRow[]>;
  finishAssetPicking: (assets: AssetRow[]) => void;
};

const AssetPickerContext = createContext<AssetPickerValue | null>(null);

export default AssetPickerContext;
