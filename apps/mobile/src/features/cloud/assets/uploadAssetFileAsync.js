import uploadFileAsync from './uploadFileAsync';

import getAssetFileUri from '@/utils/assets/files/getAssetFileUri';

export default async function uploadAssetFileAsync(asset, identity, options) {
  await uploadFileAsync(asset.filename, getAssetFileUri(asset.filename), identity, options);
}
