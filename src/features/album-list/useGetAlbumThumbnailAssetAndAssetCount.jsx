import useAssets from '@/features/assets-context/useAssets';
import getAlbumAssets from '@/utils/albums/getAlbumAssets';

export default function useGetAlbumThumbnailAssetAndAssetCount() {
  const { assets } = useAssets();

  function getAlbumThumbnailAssetAndAssetCount(album) {
    // TODO: We need to fetch all assets here just to display count
    // and thumbnail. This is not very efficient.
    // We should have a thumbnail asset and asset count on the album
    // object that is updated when the album assets are updated.
    const albumAssets = getAlbumAssets(album, assets);
    const assetIds = albumAssets.map((asset) => asset.id);
    const numberOfAssets = assetIds.length;

    // TODO: Actually to get the first asset of the album we would
    // need to use the default sort of the albums asset list.
    // But i still think thumbnail asset should be a prop on the album
    // that is updated when the album assets are updated.
    const thumbnailAsset = assets[assetIds[numberOfAssets - 1]];

    return { thumbnailAsset, numberOfAssets };
  }

  return getAlbumThumbnailAssetAndAssetCount;
}
