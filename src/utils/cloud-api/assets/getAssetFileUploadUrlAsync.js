import apiWithAuthentication from '../apiWithAuthentication';

export default async function getAssetFileUploadUrlAsync(fileKey) {
  const {
    data: { uploadUrl },
  } = await apiWithAuthentication.post('asset_files/upload_url', {
    fileKey,
  });
  return uploadUrl;
}
