import * as FileUtils from './fileUtils';

import { FILE_UPLOADER_API_URL } from '@/secrets';
import * as HttpUtils from '@/utils/cloud-file-utils/httpUtils';

const FILE_INFO_API_URL = `${FILE_UPLOADER_API_URL}files/info`;

// TODO: There is a bug in ExpoFilesystem.getInfoAsync that crashes when trying to
// return md5 checksum for files larger than 2GB. For now we can only verify
// such files by their file size.
const MAX_FILE_SIZE_FOR_CHECKSUM_VERIFICATION = 2 * 1024 * 1024 * 1024; // 2GB

// Verify integrity of uploaded file. Returns true if file is valid.
// Returns error message if file is invalid.
export async function verifyFileUpload(localUri, remoteFilePath, bucketName) {
  switch (await getFileUploadVerificationMethod(localUri)) {
    case 'size':
      return verifyFileUploadViaFileSize(localUri, remoteFilePath, bucketName);
    default:
      return verifyFileUploadViaChecksum(localUri, remoteFilePath, bucketName);
  }
}

// Returns verification method for uploaded files
// checksum: verify files by their md5 checksum
// size: verify by file size
async function getFileUploadVerificationMethod(localUri) {
  const { size: fileSize } = await FileUtils.getFileInfo(localUri);
  return fileSize > MAX_FILE_SIZE_FOR_CHECKSUM_VERIFICATION ? 'size' : 'checksum';
}

async function verifyFileUploadViaFileSize(localUri, remoteFilePath, bucketName) {
  const { size: localFileSize } = await FileUtils.getFileInfo(localUri);
  const { size: remoteFileSize } = await getFileInfo(remoteFilePath);

  if (localFileSize !== remoteFileSize) {
    return `File size mismatch! Local file: ${localFileSize}, Remote file: ${remoteFileSize}`;
  }

  return true;
}

async function verifyFileUploadViaChecksum(localUri, remoteFilePath, bucketName) {
  const localFileChecksum = await FileUtils.getFileChecksum(localUri);
  const { etag } = await getFileInfo(remoteFilePath, bucketName);
  const remoteFileChecksum = normalizeS3Etag(etag);

  if (localFileChecksum !== remoteFileChecksum) {
    return `Checksum mismatch! Local file: ${localFileChecksum}, Remote file: ${remoteFileChecksum}`;
  }

  return true;
}

async function getFileInfo(remoteFilePath, bucketName) {
  return HttpUtils.get(FILE_INFO_API_URL, {
    filename: remoteFilePath,
    bucket: bucketName,
  }).then((res) => res.data);
}

// Remove double quotes from S3 etag
function normalizeS3Etag(etag) {
  return etag.replace(/"/g, '');
}
