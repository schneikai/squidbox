import getAssetThumbnailsDirectory from './getAssetThumbnailsDirectory';

export default function getAssetThumbnailUri(thumbnailFilename, library) {
  return `${getAssetThumbnailsDirectory(library)}${thumbnailFilename}`;
}
