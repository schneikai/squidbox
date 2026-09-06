import { ASSET_THUMBNAIL_PATH } from './constants';

export default function getAssetThumbnailUri(thumbnailFilename) {
  return `${ASSET_THUMBNAIL_PATH}${thumbnailFilename}`;
}
