import { createContext } from 'react';

import type { AssetRow } from '@/sync/db/schema';
import type { AssetExclude } from '@/sync/queries/assetQuery';

export type AssetPickerValue = {
  openAssetPicker: (options?: { exclude?: AssetExclude }) => Promise<AssetRow[]>;
  finishAssetPicking: (assets: AssetRow[]) => void;
};

const AssetPickerContext = createContext<AssetPickerValue | null>(null);

export default AssetPickerContext;
