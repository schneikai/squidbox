import getAssetFileSourceAsync from './getAssetFileSourceAsync';

// Web keeps no files (library/fs.web.ts): `use` gets the cloud copy's presigned URL.
export default async function withAssetFileAsync(asset, { isAuthenticated, library, onProgress }, use) {
  const source = await getAssetFileSourceAsync(asset, { isAuthenticated, library });
  if (source.status) throw new Error(`${asset.filename} is ${source.status}`);
  await use(source.uri);
  onProgress(asset.fileSize);
}
