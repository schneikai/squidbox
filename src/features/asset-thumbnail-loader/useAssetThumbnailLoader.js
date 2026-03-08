import { use } from 'react';

import AssetThumbnailLoaderContext from './AssetThumbnailLoaderContext';

export default function useAssetThumbnailLoader() {
  return use(AssetThumbnailLoaderContext);
}
