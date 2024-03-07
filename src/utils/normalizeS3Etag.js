// Remove double quotes from S3 etag
export default function normalizeS3Etag(etag) {
  return etag.replace(/"/g, '');
}
