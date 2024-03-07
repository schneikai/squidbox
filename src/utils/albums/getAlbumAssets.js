import { SMART_ALBUM_TYPES } from './constants';

// assets here must be in object form with asset.id as the key
export default function getAlbumAssets(album, assets) {
  if (album.smartAlbumType === SMART_ALBUM_TYPES.FAVORITES) {
    return getFavoriteAssets(assets);
  }

  if (album.smartAlbumType === SMART_ALBUM_TYPES.DELETED) {
    return getDeletedAssets(assets);
  }

  const albumAssets = album.assets.map((assetId) => assets[assetId]).filter(Boolean);
  const filterFn = (asset) => !asset.isDeleted;
  return albumAssets.filter(filterFn);
}

function getFavoriteAssets(assets) {
  return Object.values(assets).filter((asset) => asset.isFavorite && !asset.isDeleted);
}

function getDeletedAssets(assets) {
  return Object.values(assets).filter((asset) => asset.isDeleted);
}
