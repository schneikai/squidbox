import getFileInfoAsync from './getFileInfoAsync';

// Heads-up: Do not use this on files larger than 2GB. It will crash because
// of a bug in Expo. If you want to validate uploaded files larger than 2GB
// you you need to compare their file size instead of their checksum for now.
export default async function getFileChecksumAsync(uri) {
  const { exists, md5 } = await getFileInfoAsync(uri, { md5: true });
  if (!exists) throw new Error('File not found!');
  return md5;
}
