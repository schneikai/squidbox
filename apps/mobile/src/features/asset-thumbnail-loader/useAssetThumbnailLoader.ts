import AssetThumbnailLoaderContext from './AssetThumbnailLoaderContext';

import useRequiredContext from '@/hooks/useRequiredContext';

export default function useAssetThumbnailLoader() {
  return useRequiredContext(
    AssetThumbnailLoaderContext,
    'useAssetThumbnailLoader must be used inside AssetThumbnailLoaderProvider',
  );
}
