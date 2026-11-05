import { createContext } from 'react';

import type preloadAssetThumbnailsAsync from '@/features/cloud/assets/preloadAssetThumbnailsAsync';

// `loadThumbnail(asset, onResult)` (createThumbnailQueue's `request`) returns the withdraw function.
export type AssetThumbnailLoader = {
  loadThumbnail: (
    asset: Parameters<typeof preloadAssetThumbnailsAsync>[0][number],
    onResult: (result: 'done' | 'failed') => void,
  ) => () => void;
};

const AssetThumbnailLoaderContext = createContext<AssetThumbnailLoader | null>(null);

export default AssetThumbnailLoaderContext;
