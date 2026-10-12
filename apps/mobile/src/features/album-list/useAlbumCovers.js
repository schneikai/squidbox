import { useMemo } from 'react';

import useAlbums from '@/features/albums-context/useAlbums';
import useAppSettings from '@/features/app-settings/useAppSettings';
import { getAssetSortFunction } from '@/features/asset-list/actions/sort-assets-action/useSortAssetsAction';
import useAssets from '@/features/assets-context/useAssets';
import getAlbumAssets from '@/utils/albums/getAlbumAssets';
import getAlbumSortOrder from '@/utils/albums/getAlbumSortOrder';

// Every album's cover (the asset it shows first, in the album screen's order) and asset count,
// computed once when albums or assets change instead of in each album cell on every render.
export default function useAlbumCovers() {
  const { albums } = useAlbums();
  const { assets } = useAssets();
  const { albumSortOrder } = useAppSettings();

  return useMemo(() => {
    const covers = {};
    for (const album of Object.values(albums)) {
      const albumAssets = getAlbumAssets(album, assets);
      const sortFunction = getAssetSortFunction(getAlbumSortOrder(album, albumSortOrder));
      const thumbnailAsset = albumAssets.reduce(
        (first, asset) => (first && sortFunction(first, asset) <= 0 ? first : asset),
        undefined,
      );
      covers[album.id] = { thumbnailAsset, numberOfAssets: albumAssets.length };
    }
    return covers;
  }, [albums, assets, albumSortOrder]);
}
