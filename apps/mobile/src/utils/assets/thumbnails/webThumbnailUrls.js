// Web has no file system to cache thumbnails in, so the web versions of the thumbnail helpers keep
// each thumbnail's presigned URL here and let the browser cache the image.
const webThumbnailUrls = new Map();

export default webThumbnailUrls;
