import { describe, it, expect, vi, beforeEach } from 'vitest';

// The file-system calls made, and how the download and the `use` step end.
const fs: string[] = [];
const outcome: { download: 'ok' | Error; use: 'ok' | Error } = { download: 'ok', use: 'ok' };

vi.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///caches/',
  deleteAsync: async (uri: string) => {
    fs.push(`delete ${uri}`);
  },
}));
vi.mock('../src/utils/assets/files/getAssetFileSourceAsync', () => ({
  default: async () => ({ uri: 'https://s3/a.jpg', isRemote: true }),
}));
vi.mock('../src/features/cloud/assets/downloadAssetFileAsync', () => ({
  default: async ({ filename }: { filename: string }, _url: string, directory: string) => {
    if (outcome.download !== 'ok') throw outcome.download;
    fs.push(`download ${directory}${filename}`);
    return `${directory}${filename}`;
  },
}));
vi.mock('../src/utils/getNewItemId', () => ({ default: () => 'uuid' }));

const { default: withAssetFileAsync } = await import('../src/utils/assets/files/withAssetFileAsync');

const library = { downloadsDir: 'downloads/abc/' };
const run = (keepDownloads = false) =>
  withAssetFileAsync({ filename: 'a.jpg' }, { library, onProgress: () => {}, keepDownloads }, async (uri: string) => {
    if (outcome.use !== 'ok') throw outcome.use;
    fs.push(`use ${uri}`);
  });

describe('withAssetFileAsync', () => {
  beforeEach(() => {
    fs.length = 0;
    outcome.download = 'ok';
    outcome.use = 'ok';
  });

  it('downloads into a folder of its own and deletes it after use', async () => {
    await run();
    expect(fs).toEqual([
      'download file:///caches/downloads/abc/a.jpg-uuid/a.jpg',
      'use file:///caches/downloads/abc/a.jpg-uuid/a.jpg',
      'delete file:///caches/downloads/abc/a.jpg-uuid/',
    ]);
  });

  it('keeps the folder with keepDownloads', async () => {
    await run(true);
    expect(fs.at(-1)).toBe('use file:///caches/downloads/abc/a.jpg-uuid/a.jpg');
  });

  it('deletes the folder when the download or the use fails, even with keepDownloads, and keeps the error', async () => {
    outcome.download = Object.assign(new Error('cancelled'), { name: 'AbortError' });
    await expect(run(true)).rejects.toMatchObject({ name: 'AbortError' });
    expect(fs).toEqual(['delete file:///caches/downloads/abc/a.jpg-uuid/']);

    fs.length = 0;
    outcome.download = 'ok';
    outcome.use = new Error('Photos refused');
    await expect(run(true)).rejects.toThrow('Photos refused');
    expect(fs.at(-1)).toBe('delete file:///caches/downloads/abc/a.jpg-uuid/');
  });
});
