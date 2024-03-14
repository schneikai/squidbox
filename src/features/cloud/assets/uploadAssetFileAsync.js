import uploadFileAsync from './uploadFileAsync';

import getAssetFileUri from '@/utils/assets/files/getAssetFileUri';

export default async function uploadAssetFileAsync(asset, onProgress) {
  // We pass in the file size from the asset object to avoid reading the file size
  // in the validateUploadedFileAsync function which can crash the app on very large files.
  // See the validateUploadedFileAsync function for more details.
  await uploadFileAsync(asset.filename, getAssetFileUri(asset.filename), asset.fileSize, onProgress);
}
