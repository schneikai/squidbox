import apiWithAuthentication from '../apiWithAuthentication';

export default async function getAssetFileInfoAsync(fileKey) {
  const { data } = await apiWithAuthentication.post('asset_files/file_info', {
    fileKey,
  });
  return data;
}
