import apiWithAuthentication from '../apiWithAuthentication';

export default async function getAssetFileInfoAsync(fileKey) {
  const { data } = await apiWithAuthentication.post('asset_files/file_info', {
    fileKey,
  });

  // Remove double quotes from S3 etag
  // I don't know why they are there but to compare the etag with a checksum
  // from a local file we need to remove the double quotes from the etag.
  // Note: etag may be undefined during background uploads, so check first
  if (data.etag) {
    data.etag = data.etag.replace(/"/g, '');
  }

  return data;
}
