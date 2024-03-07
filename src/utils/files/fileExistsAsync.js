import getFileInfoAsync from './getFileInfoAsync';

export default async function fileExistsAsync(uri) {
  const { exists } = await getFileInfoAsync(uri);
  return exists;
}
