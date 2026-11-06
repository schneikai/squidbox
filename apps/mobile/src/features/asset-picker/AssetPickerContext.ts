import { createContext } from 'react';

import type assetQuery from '@/features/asset-list/assetQuery';
import type { AssetRow } from '@/sync/db/schema';

// What the picker leaves out, as assetQuery's JSDoc has it: a post's ids or `{ albumId }`.
export type AssetExclude = NonNullable<Parameters<typeof assetQuery>[0]['exclude']>;

export type AssetPickerValue = {
  openAssetPicker: (options?: { exclude?: AssetExclude }) => Promise<AssetRow[]>;
  finishAssetPicking: (assets: AssetRow[]) => void;
};

const AssetPickerContext = createContext<AssetPickerValue | null>(null);

export default AssetPickerContext;
