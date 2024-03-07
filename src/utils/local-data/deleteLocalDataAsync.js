import * as FileSystem from 'expo-file-system';

import { DATA_FILES } from './constants';
import getDataFileUri from './getDataFileUri';

import { ASSET_FILE_PATH } from '@/utils/assets/files/constants';
// import { ASSET_THUMBNAIL_PATH } from '@/utils/assets/thumbnails/constants';

export default async function deleteLocalDataAsync() {
  for (const filename of DATA_FILES) {
    const dataPartUri = getDataFileUri(filename);
    await FileSystem.deleteAsync(dataPartUri, { idempotent: true });
  }

  // Delete asset files.
  await FileSystem.deleteAsync(ASSET_FILE_PATH, { idempotent: true });

  // TODO: I decided to keep the thumbnails so they are still available
  // when users log back in. A user might have a lot of assets and deleting
  // them would make switching between accounts very slow since we would
  // have to download all the thumbnails again.
  // await FileSystem.deleteAsync(ASSET_THUMBNAIL_PATH, { idempotent: true });
}
