import { useEffect, useState } from 'react';

import AssetThumbnailLoaderContext from './AssetThumbnailLoaderContext';

import useAssets from '@/features/assets-context/useAssets';
import useCloud from '@/features/cloud/useCloud';

// TODO: If we have more that a few assets, we should show a banner
// here that assets are downloading and it can take some time to complete.

// TODO: Right now we always use file system checks to see if a thumbnail
// exists. Have to see how stressing this is for the device if we have a lot
// of assets. Maybe we can keep a list of preloaded thumbnails in memory
// and check that first before checking the file system.

export default function AssetThumbnailLoaderProvider({ children }) {
  const { assets } = useAssets();
  const [priorityAssets, setPriorityAssets] = useState([]);
  const { isAuthenticated, preloadAssetThumbnailsAsync } = useCloud();

  // Preload all thumbnails
  useEffect(() => {
    if (!isAuthenticated) return;
    preloadAssetThumbnailsAsync(Object.values(assets).reverse());
  }, [isAuthenticated]);

  // Preload thumbnails for assets that are in the priority list
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isAuthenticated || priorityAssets.length === 0) return;
      const assetsToLoad = [...priorityAssets];
      preloadAssetThumbnailsAsync(assetsToLoad);
      setPriorityAssets((priorityAssets) =>
        priorityAssets.filter((asset) => !assetsToLoad.some((assetToLoad) => assetToLoad.id === asset.id)),
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [priorityAssets, isAuthenticated]);

  function loadThumbnail(asset) {
    setPriorityAssets((priorityAssets) => {
      if (priorityAssets.some((priorityAsset) => priorityAsset.id === asset.id)) {
        return priorityAssets;
      }
      return [...priorityAssets, asset];
    });
  }

  const value = {
    loadThumbnail,
  };

  return <AssetThumbnailLoaderContext.Provider value={value}>{children}</AssetThumbnailLoaderContext.Provider>;
}
