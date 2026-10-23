import { describe, it, expect, vi, beforeEach } from 'vitest';

import { libraryPaths } from '../src/library/libraryPaths';

// A record of the file-system calls the file helpers make.
const fs: string[] = [];
const folders: Record<string, string[]> = {}; // what readDirectoryAsync lists, by folder
const failing = new Set<string>(); // folders whose next listing fails

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
    if (failing.delete(uri)) throw new Error(`cannot list ${uri}`);
    return folders[uri];
  },
}));

// The status helper makes a missing thumbnail again from its original; none of these assets has one.
vi.mock('../src/utils/thumbnails/createThumbnail', () => ({ default: vi.fn() }));

const { getAssetFileUri, createAssetDirectoriesAsync, assetFileExistsAsync, getAssetThumbnailUri, hasThumbnailAsync } =
  await import('../src/utils/assets/assetStorage');
const { default: getAssetThumbnailStatusAsync } =
  await import('../src/utils/assets/thumbnails/getAssetThumbnailStatusAsync');
const { purgedFilesRemover, removeAssetFiles } = await import('../src/library/fs');

const abc = libraryPaths('abc');

describe('asset file and thumbnail paths', () => {
  beforeEach(() => {
    fs.length = 0;
  });

  it('resolve against the library they are given', async () => {
    expect(getAssetFileUri('a.jpg', abc)).toBe('file:///documents/libraries/abc/files/a.jpg');
    expect(getAssetThumbnailUri('athumb.jpg', abc)).toBe('file:///documents/libraries/abc/thumbnails/athumb.jpg');
    await createAssetDirectoriesAsync(abc);
    expect(fs).toEqual([
      'mkdir file:///documents/libraries/abc/files/',
      'mkdir file:///documents/libraries/abc/thumbnails/',
    ]);
  });

  it('the migrated library keeps its folders from before libraries', () => {
    const migrated = libraryPaths('squidbox');
    expect(getAssetFileUri('a.jpg', migrated)).toBe('file:///documents/assetfiles/a.jpg');
    expect(getAssetThumbnailUri('athumb.jpg', migrated)).toBe('file:///documents/assetthumbnails/athumb.jpg');
  });

  it('removing an asset’s copies deletes its file and thumbnail in its library', async () => {
    await removeAssetFiles([{ filename: 'a.jpg', thumbnailFilename: 'athumb.jpg' }], abc);
    expect(fs).toEqual([
      'delete file:///documents/libraries/abc/files/a.jpg',
      'delete file:///documents/libraries/abc/thumbnails/athumb.jpg',
    ]);
  });

  it('existence checks look in the library they were given', async () => {
    expect(await assetFileExistsAsync('present.jpg', abc)).toBe(true);
    expect(await assetFileExistsAsync('missing.jpg', abc)).toBe(false);
    expect(await hasThumbnailAsync('present.jpg', libraryPaths('other'))).toBe(true);
    expect(await hasThumbnailAsync(null, abc)).toBe(true);
    await removeAssetFiles([{ filename: 'a.jpg' }], abc); // a backed-up file: its thumbnail stays
    expect(fs).toEqual(['delete file:///documents/libraries/abc/files/a.jpg']);
  });

  it('a thumbnail on this device is local, one not backed up yet is not uploaded, else it’s in the cloud', async () => {
    const status = (asset: object, isAuthenticated = true) =>
      getAssetThumbnailStatusAsync(asset, { isAuthenticated, library: abc });
    expect(await status({ thumbnailFilename: 'present.jpg', isThumbnailSynced: false })).toBe('local');
    expect(await status({ thumbnailFilename: 'missing.jpg', isThumbnailSynced: false })).toBe('notUploaded');
    expect(await status({ thumbnailFilename: 'missing.jpg', isThumbnailSynced: false }, false)).toBe('notUploaded');
    expect(await status({ thumbnailFilename: 'missing.jpg', isThumbnailSynced: true })).toBe('remote');
    expect(await status({ thumbnailFilename: 'missing.jpg', isThumbnailSynced: true }, false)).toBe('signedOut');
  });

  it('removing many assets’ copies lists each folder once and deletes only the files that are there', async () => {
    folders['file:///documents/libraries/abc/files/'] = ['a0.jpg', 'unrelated.jpg'];
    folders['file:///documents/libraries/abc/thumbnails/'] = ['a0-t.jpg', 'a1-t.jpg'];
    const assets = Array.from({ length: 100 }, (_, i) => ({ filename: `a${i}.jpg`, thumbnailFilename: `a${i}-t.jpg` }));
    await removeAssetFiles(assets, abc);
    expect(fs.sort()).toEqual([
      'delete file:///documents/libraries/abc/files/a0.jpg',
      'delete file:///documents/libraries/abc/thumbnails/a0-t.jpg',
      'delete file:///documents/libraries/abc/thumbnails/a1-t.jpg',
      'list file:///documents/libraries/abc/files/',
      'list file:///documents/libraries/abc/thumbnails/',
    ]);
    fs.length = 0;
    await removeAssetFiles([], abc);
    expect(fs).toEqual([]);
  });

  it('removing an asset also removes the downloads kept for a share sheet', async () => {
    const uuid = '3f2a0000-0000-4000-8000-000000000001';
    folders['file:///caches/downloads/abc/'] = [`a.jpg-${uuid}`, `b.jpg-${uuid}`];
    await removeAssetFiles([{ filename: 'a.jpg' }], abc);
    expect(fs).toEqual([
      'list file:///caches/downloads/abc/',
      'delete file:///documents/libraries/abc/files/a.jpg',
      `delete file:///caches/downloads/abc/a.jpg-${uuid}/`,
    ]);
    delete folders['file:///caches/downloads/abc/'];
  });

  it('a remover whose listing failed lists again at its next call, instead of failing every one', async () => {
    const downloads = 'file:///caches/downloads/abc/';
    folders[downloads] = [];
    failing.add(downloads);
    const remove = purgedFilesRemover(abc);
    await expect(remove([{ filename: 'a.jpg' }])).rejects.toThrow('cannot list');
    fs.length = 0;
    await remove([{ filename: 'a.jpg' }]);
    expect(fs).toEqual([`list ${downloads}`, 'delete file:///documents/libraries/abc/files/a.jpg']);
    delete folders[downloads];
  });

  it('refuse to resolve without a library, instead of guessing the open one', () => {
    expect(() => getAssetFileUri('a.jpg')).toThrow(TypeError);
  });
});
