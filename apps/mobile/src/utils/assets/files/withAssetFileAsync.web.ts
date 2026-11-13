import getAssetFileSourceAsync from './getAssetFileSourceAsync';
import type { AssetFileAsset } from './getAssetFileStatusAsync';
import type { WithAssetFileOptions } from './withAssetFileAsync';

// Web keeps no files (library/fs.web.ts): `run` gets the cloud copy's presigned URL.
export default async function withAssetFileAsync(
  asset: AssetFileAsset,
  { isAuthenticated, library }: Pick<WithAssetFileOptions, 'isAuthenticated' | 'library'>,
  run: (uri: string) => Promise<unknown> | unknown,
): Promise<void> {
  const source = await getAssetFileSourceAsync(asset, { isAuthenticated, library });
  if (source.status) throw new Error(`${asset.filename} is ${source.status}`);
  await run(source.uri);
}
