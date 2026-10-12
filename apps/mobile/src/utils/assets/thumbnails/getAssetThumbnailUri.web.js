import webThumbnailUrls from './webThumbnailUrls';

export default function getAssetThumbnailUri(thumbnailFilename) {
  return webThumbnailUrls.get(thumbnailFilename);
}
