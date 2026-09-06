import apiWithAuthentication from '../apiWithAuthentication';

export default async function deleteAssetFileAsync(fileKey) {
  await apiWithAuthentication.post('asset_files/delete_file', { fileKey });
}
