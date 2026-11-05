import type { AssetRecord } from '@squidbox/shared';
import { createContext } from 'react';

// `loadThumbnail(asset, onResult)` (createThumbnailQueue's `request`, which keys on the thumbnail's
// name and hands the assets to preloadAssetThumbnailsAsync) returns the withdraw function.
export type AssetThumbnailLoader = {
  loadThumbnail: (
    asset: Pick<AssetRecord, 'thumbnailFilename'>,
    onResult: (result: 'done' | 'failed') => void,
  ) => () => void;
};

const AssetThumbnailLoaderContext = createContext<AssetThumbnailLoader | null>(null);

export default AssetThumbnailLoaderContext;
