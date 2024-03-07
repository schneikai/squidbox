// Not using this anymore! I keep it around in case we want to recyle
// some of the code in the future.

// This required a file src/secrets.js with the following content:
// export const FILE_UPLOADER_API_URL = 'https://calm-spire-55473-bde7287eddd0.herokuapp.com/';

import * as FileSystem from 'expo-file-system';
import uuid from 'react-native-uuid';

import { FILE_UPLOADER_API_URL } from '@/secrets';
import * as HttpUtils from '@/utils/cloud-file-utils/httpUtils';
import { verifyFileUpload } from '@/utils/cloud-file-utils/verifyFileUploadUtils';

const INIT_UPLOAD_API_URL = `${FILE_UPLOADER_API_URL}upload/init`;
const DELETE_FILE_API_URL = `${FILE_UPLOADER_API_URL}files/delete`;
const GET_PUBLIC_URL_API_URL = `${FILE_UPLOADER_API_URL}files/public_url`;

// TODO: Do not use the bucket name in the request and instead add authorization to the API.

// Upload a local file to the storage and return its public URL.
export async function uploadFile(localUri, remoteFilePath, bucketName) {
  const { presignedUrl, publicUrl } = await getPresignedUrl(remoteFilePath, bucketName);

  // TODO: For some strange reason files from the media library cannot be uploaded.
  // On the simulator it works but from the device the files arrive with 0 bytes on S3.
  // As a workaround I copy the file and upload this copy.
  const fileCopyUri = `${FileSystem.cacheDirectory}upload-file-${uuid.v4()}`;
  await FileSystem.copyAsync({ from: localUri, to: fileCopyUri });

  try {
    await FileSystem.uploadAsync(presignedUrl, fileCopyUri, {
      httpMethod: 'PUT',
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      // Remember: sessionType is only available on iOS!
      // KS: Upload crashes on large files. Trying to fix...
      // sessionType: FileSystem.FileSystemSessionType.BACKGROUND,
      sessionType: FileSystem.FileSystemSessionType.FOREGROUND,
    });
  } finally {
    FileSystem.deleteAsync(fileCopyUri, { idempotent: true });
  }

  const verificationResult = await verifyFileUpload(localUri, remoteFilePath, bucketName);
  if (verificationResult !== true) throw new Error(`File verification failed: ${verificationResult}`);

  return publicUrl;
}

// Delete a file from the storage.
export function deleteFile(remoteFilePath, bucketName) {
  return HttpUtils.post(DELETE_FILE_API_URL, {
    filename: remoteFilePath,
    bucket: bucketName,
  });
}

// Returns a files public URL that can be used to download if via HTTP for example.
export async function getPublicUrl(remoteFilePath, bucketName) {
  const {
    data: { publicUrl },
  } = await HttpUtils.get(GET_PUBLIC_URL_API_URL, {
    filename: remoteFilePath,
    bucket: bucketName,
  });

  return publicUrl;
}

// Returns a URL from the storage that can be used to upload a file.
async function getPresignedUrl(remoteFilePath, bucketName) {
  const {
    data: { presignedUrl, publicUrl },
  } = await HttpUtils.post(INIT_UPLOAD_API_URL, {
    filename: remoteFilePath,
    bucket: bucketName,
  });

  return { presignedUrl, publicUrl };
}
