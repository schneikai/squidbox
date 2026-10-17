import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { OpenLibrary } from '../src/library/current';
import { libraryPaths } from '../src/library/libraryPaths';

// The open library, as the file helpers see it, and a record of the file-system calls they make.
const current: { library: OpenLibrary | null } = { library: null };
const fs: string[] = [];
const folders: Record<string, string[]> = {}; // what readDirectoryAsync lists, by folder

vi.mock('../src/library/current', () => ({
  getLibrary: () => {
    if (!current.library) throw new Error('No library is open');
    return current.library;
  },
}));
vi.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///documents/',
  cacheDirectory: 'file:///caches/',
  makeDirectoryAsync: async (uri: string) => {
    fs.push(`mkdir ${uri}`);
  },
  deleteAsync: async (uri: string) => {
    fs.push(`delete ${uri}`);
  },
  getInfoAsync: async (uri: string) => ({ exists: uri.endsWith('present.jpg') || uri in folders }),
  readDirectoryAsync: async (uri: string) => {
    fs.push(`list ${uri}`);
    return folders[uri];
  },
}));

const { default: getAssetFileUri } = await import('../src/utils/assets/files/getAssetFileUri');
const { default: createAssetFileDirectory } = await import('../src/utils/assets/files/createAssetFileDirectory');
const { default: assetFileExistsAsync } = await import('../src/utils/assets/files/assetFileExistsAsync');
const { default: getAssetThumbnailUri } = await import('../src/utils/assets/thumbnails/getAssetThumbnailUri');
const { default: createAssetThumbnailDirectory } =
  await import('../src/utils/assets/thumbnails/createAssetThumbnailDirectory');
const { default: hasThumbnailAsync } = await import('../src/utils/assets/thumbnails/hasThumbnailAsync');
const { default: getAssetThumbnailStatusAsync } =
  await import('../src/utils/assets/thumbnails/getAssetThumbnailStatusAsync');
const { removeAssetFiles } = await import('../src/library/fs');

const open = (id: string): OpenLibrary => ({ id, ...libraryPaths(id) });

describe('asset file and thumbnail paths', () => {
  beforeEach(() => {
    current.library = open('abc');
    fs.length = 0;
  });

  it('resolve against the open library', async () => {
    expect(getAssetFileUri('a.jpg')).toBe('file:///documents/libraries/abc/files/a.jpg');
    expect(getAssetThumbnailUri('athumb.jpg')).toBe('file:///documents/libraries/abc/thumbnails/athumb.jpg');
    await createAssetFileDirectory();
    await createAssetThumbnailDirectory();
    expect(fs).toEqual([
      'mkdir file:///documents/libraries/abc/files/',
      'mkdir file:///documents/libraries/abc/thumbnails/',
    ]);
  });

  it('the migrated library keeps its folders from before libraries', () => {
    current.library = open('squidbox');
    expect(getAssetFileUri('a.jpg')).toBe('file:///documents/assetfiles/a.jpg');
    expect(getAssetThumbnailUri('athumb.jpg')).toBe('file:///documents/assetthumbnails/athumb.jpg');
  });

  it('a captured library keeps resolving against itself after the open one changed', async () => {
    const captured = current.library!;
    current.library = open('other');
    expect(getAssetFileUri('a.jpg', captured)).toBe('file:///documents/libraries/abc/files/a.jpg');
    expect(getAssetThumbnailUri('athumb.jpg', captured)).toBe('file:///documents/libraries/abc/thumbnails/athumb.jpg');
    await removeAssetFiles([{ filename: 'a.jpg', thumbnailFilename: 'athumb.jpg' }], captured);
    expect(fs).toEqual([
      'delete file:///documents/libraries/abc/files/a.jpg',
      'delete file:///caches/downloads/abc/a.jpg',
      'delete file:///documents/libraries/abc/thumbnails/athumb.jpg',
    ]);
  });

  it('existence checks look in the library they were given', async () => {
    expect(await assetFileExistsAsync('present.jpg')).toBe(true);
    expect(await assetFileExistsAsync('missing.jpg')).toBe(false);
    expect(await hasThumbnailAsync('present.jpg', open('other'))).toBe(true);
    expect(await hasThumbnailAsync(null)).toBe(true);
    await removeAssetFiles([{ filename: 'a.jpg' }], open('abc')); // a backed-up file: its thumbnail stays
    expect(fs).toEqual([
      'delete file:///documents/libraries/abc/files/a.jpg',
      'delete file:///caches/downloads/abc/a.jpg',
    ]);
  });

  it('a thumbnail on this device is local, one not backed up yet is not uploaded, else it’s in the cloud', async () => {
    const status = (asset: object, isAuthenticated = true) => getAssetThumbnailStatusAsync(asset, { isAuthenticated });
    expect(await status({ thumbnailFilename: 'present.jpg', isThumbnailSynced: false })).toBe('local');
    expect(await status({ thumbnailFilename: 'missing.jpg', isThumbnailSynced: false })).toBe('notUploaded');
    expect(await status({ thumbnailFilename: 'missing.jpg', isThumbnailSynced: false }, false)).toBe('notUploaded');
    expect(await status({ thumbnailFilename: 'missing.jpg', isThumbnailSynced: true })).toBe('remote');
    expect(await status({ thumbnailFilename: 'missing.jpg', isThumbnailSynced: true }, false)).toBe('signedOut');
  });

  it('removing many assets’ copies lists each folder once and deletes only the files that are there', async () => {
    folders['file:///documents/libraries/abc/files/'] = ['a0.jpg', 'unrelated.jpg'];
    folders['file:///documents/libraries/abc/thumbnails/'] = ['a0-t.jpg', 'a1-t.jpg'];
    // No downloads folder: nothing was ever fetched.
    const assets = Array.from({ length: 100 }, (_, i) => ({ filename: `a${i}.jpg`, thumbnailFilename: `a${i}-t.jpg` }));
    await removeAssetFiles(assets, open('abc'));
    expect(fs.sort()).toEqual([
      'delete file:///documents/libraries/abc/files/a0.jpg',
      'delete file:///documents/libraries/abc/thumbnails/a0-t.jpg',
      'delete file:///documents/libraries/abc/thumbnails/a1-t.jpg',
      'list file:///documents/libraries/abc/files/',
      'list file:///documents/libraries/abc/thumbnails/',
    ]);
    fs.length = 0;
    await removeAssetFiles([], open('abc'));
    expect(fs).toEqual([]);
  });

  it('refuse to resolve while no library is open', () => {
    current.library = null;
    expect(() => getAssetFileUri('a.jpg')).toThrow('No library is open');
  });
});
