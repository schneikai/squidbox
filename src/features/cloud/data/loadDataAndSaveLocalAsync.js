import * as FileSystem from 'expo-file-system';

import getDataAsync from '@/utils/cloud-api/data/getDataAsync';
import { DATA_FILES } from '@/utils/local-data/constants';
import getDataFileUri from '@/utils/local-data/getDataFileUri';

export default async function loadDataAndSaveLocalAsync() {
  const data = await getDataAsync();

  for (const filename of DATA_FILES) {
    const fileUrl = data[filename];
    if (!fileUrl) continue;

    const fileUri = getDataFileUri(filename);
    await FileSystem.downloadAsync(fileUrl, fileUri);
  }
}
