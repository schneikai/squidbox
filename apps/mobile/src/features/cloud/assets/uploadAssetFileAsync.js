import uploadFileAsync from './uploadFileAsync';

import getAssetFileUri from '@/utils/assets/files/getAssetFileUri';

// `library`: the one the asset's file is in (captured at the backup run's start).
export default async function uploadAssetFileAsync(asset, identity, { library, ...options }) {
  await uploadFileAsync(asset.filename, getAssetFileUri(asset.filename, library), identity, options);
}
