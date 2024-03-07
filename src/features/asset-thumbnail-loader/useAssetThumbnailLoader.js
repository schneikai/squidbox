import { useContext } from 'react';

import AssetThumbnailLoaderContext from './AssetThumbnailLoaderContext';

export default function useAssetThumbnailLoader() {
  return useContext(AssetThumbnailLoaderContext);
}
