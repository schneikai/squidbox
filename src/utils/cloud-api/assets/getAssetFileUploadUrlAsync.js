import apiWithAuthentication from '../apiWithAuthentication';

export default async function getAssetFileUploadUrlAsync(fileKey, fileSize) {
  // API uses file size to determine whether to return S3 presigned URL or API proxy URL
  // Files >= 4GB use API proxy upload, files < 4GB use direct S3 upload
  const {
    data: { uploadUrl },
  } = await apiWithAuthentication.post('asset_files/upload_url', {
    fileKey,
    fileSize,
  });
  return uploadUrl;
}
