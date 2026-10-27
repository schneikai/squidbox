import resizeToJpegAsync from './resizeToJpegAsync';

const THUMBNAIL_SIZE = 1000;

// A JPEG of the image at `uri` whose longer side is THUMBNAIL_SIZE; resolves to its uri.
export default async function resizeToThumbnail(uri, width, height) {
  const { uri: thumbnailUri } = await resizeToJpegAsync(uri, { width, height, longSide: THUMBNAIL_SIZE });
  return thumbnailUri;
}
