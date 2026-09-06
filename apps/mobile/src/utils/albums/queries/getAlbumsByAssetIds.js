import arrayOrMapToArray from '@/utils/arrayOrMapToArray';

export default function getAlbumsByAssetIds(assetIds, albums) {
  return arrayOrMapToArray(albums).filter((album) => album.assets.some((assetId) => assetIds.includes(assetId)));
}
