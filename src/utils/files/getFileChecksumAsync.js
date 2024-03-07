import getFileInfoAsync from './getFileInfoAsync';

// TODO: In older versions of Expo this crashed on files larger than 2GB!
// Have to check if this is still the case in current Expo version.
export default async function getFileChecksumAsync(uri) {
  const { exists, md5 } = await getFileInfoAsync(uri, { md5: true });
  if (!exists) throw new Error('File not found!');
  return md5;
}
