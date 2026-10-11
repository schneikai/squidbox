import useAppSettings from '@/features/app-settings/useAppSettings';
import { getAssetSortFunction } from '@/features/asset-list/actions/sort-assets-action/useSortAssetsAction';
import useAssets from '@/features/assets-context/useAssets';
import getAlbumAssets from '@/utils/albums/getAlbumAssets';
import getAlbumSortOrder from '@/utils/albums/getAlbumSortOrder';

export default function useGetAlbumThumbnailAssetAndAssetCount() {
  const { assets } = useAssets();
  const { albumSortOrder } = useAppSettings();

  function getAlbumThumbnailAssetAndAssetCount(album) {
    // TODO: We need to fetch all assets here just to display count
    // and thumbnail. This is not very efficient.
    // We should have a thumbnail asset and asset count on the album
    // object that is updated when the album assets are updated.
    const albumAssets = getAlbumAssets(album, assets);

    // The cover is the asset the album shows first, in the same order as the album screen.
    const sortFunction = getAssetSortFunction(getAlbumSortOrder(album, albumSortOrder));
    const thumbnailAsset = albumAssets.reduce(
      (first, asset) => (first && sortFunction(first, asset) <= 0 ? first : asset),
      undefined,
    );

    return { thumbnailAsset, numberOfAssets: albumAssets.length };
  }

  return getAlbumThumbnailAssetAndAssetCount;
}
