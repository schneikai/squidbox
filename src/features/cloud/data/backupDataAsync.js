import * as FileSystem from 'expo-file-system';

import finalizeBackupAsync from '@/utils/cloud-api/data/finalizeBackupAsync';
import initBackupAsync from '@/utils/cloud-api/data/initBackupAsync';
import { DATA_FILES } from '@/utils/local-data/constants';
import getDataFileUri from '@/utils/local-data/getDataFileUri';

export default async function backupDataAsync() {
  const backupFiles = await initBackupAsync(DATA_FILES);

  for (const { fileKey, uploadUrl } of backupFiles) {
    const fileUri = getDataFileUri(fileKey);
    await FileSystem.uploadAsync(uploadUrl, fileUri, {
      httpMethod: 'PUT',
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    });
  }

  await finalizeBackupAsync(backupFiles);
}
