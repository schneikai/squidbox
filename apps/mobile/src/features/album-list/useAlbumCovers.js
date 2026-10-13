import { useMemo } from 'react';

import useAlbums from '@/features/albums-context/useAlbums';
import useAppSettings from '@/features/app-settings/useAppSettings';
import { getAssetSortFunction } from '@/features/asset-list/actions/sort-assets-action/useSortAssetsAction';
import useAssets from '@/features/assets-context/useAssets';
import getAlbumAssets from '@/utils/albums/getAlbumAssets';
import getAlbumSortOrder from '@/utils/albums/getAlbumSortOrder';

// The cover (the asset it shows first, in the album screen's order) and asset count of each of
// these albums, computed once when they or the assets change instead of in each cell on every render.
export default function useAlbumCovers(albumIds) {
  const { albums } = useAlbums();
  const { assets } = useAssets();
  const { albumSortOrder } = useAppSettings();

  return useMemo(() => {
    const covers = {};
    for (const album of albumIds.map((id) => albums[id]).filter(Boolean)) {
      const albumAssets = getAlbumAssets(album, assets);
      const sortFunction = getAssetSortFunction(getAlbumSortOrder(album, albumSortOrder));
      const thumbnailAsset = albumAssets.reduce(
        (first, asset) => (first && sortFunction(first, asset) <= 0 ? first : asset),
        undefined,
      );
      covers[album.id] = { thumbnailAsset, numberOfAssets: albumAssets.length };
    }
    return covers;
  }, [albumIds, albums, assets, albumSortOrder]);
}
