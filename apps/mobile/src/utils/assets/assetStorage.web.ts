import webFileUrls from './webFileUrls';

import type { FileFolder } from '@/library/fileFields';

// Web has no file system: no originals are kept, and a thumbnail or a file field's file is the
// presigned URL fetched for it (webFileUrls), which the browser caches. The folders are as on iOS (assetDirectories); these
// replace its exists checks and thumbnail uri.
export {
  getAssetFilesDirectory,
  getAssetThumbnailsDirectory,
  getDownloadsDirectory,
  getAssetFileUri,
  getFileFolderUri,
  createAssetDirectoriesAsync,
} from './assetDirectories';

// Undefined until the thumbnail's URL was fetched (preloadFilesAsync.web), where the native uri is
// always a path.
export function getAssetThumbnailUri(thumbnailFilename: string): string | undefined {
  return webFileUrls.get(thumbnailFilename);
}

// A file field's file is its presigned URL too, under its own name.
export function getFieldFileUri(_folder: FileFolder, filename: string): string | undefined {
  return webFileUrls.get(filename);
}

export function getAvatarUri(avatarFilename: string): string | undefined {
  return webFileUrls.get(avatarFilename);
}

export async function hasAvatarAsync(avatarFilename: string): Promise<boolean> {
  return webFileUrls.has(avatarFilename);
}

// The web preview keeps no files.
export function deleteAvatar(): void {}

export async function assetFileExistsAsync(): Promise<boolean> {
  return false;
}

export async function hasThumbnailAsync(thumbnailFilename: string | null | undefined): Promise<boolean> {
  if (!thumbnailFilename) return true;
  return webFileUrls.has(thumbnailFilename);
}
