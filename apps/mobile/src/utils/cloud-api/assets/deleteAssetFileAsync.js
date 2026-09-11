import apiWithAuthentication from '../apiWithAuthentication';

// Delete asset files/thumbnails from S3 via the new backend: POST /assets/delete { keys }.
export default async function deleteAssetFileAsync(fileKey) {
  await apiWithAuthentication.post('assets/delete', { keys: [fileKey] });
}
