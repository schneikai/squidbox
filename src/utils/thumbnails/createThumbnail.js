import createImageThumbnail from './createImageThumbnail';
import createVideoThumbnail from './createVideoThumbnail';

// Would be nice to detect the media type from the given file but there
// is not build in way to do that in Expo and we could only do it
// by checking the file extension which might not reliable.
export default async function createThumbnail(uri, mediaType) {
  if (mediaType === 'image') {
    return createImageThumbnail(uri);
  } else if (mediaType === 'video') {
    return createVideoThumbnail(uri);
  } else {
    throw new Error(`Cannot create thumbnail for unsupported media type: ${mediaType}`);
  }
}
