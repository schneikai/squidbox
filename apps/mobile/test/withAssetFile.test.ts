import { describe, it, expect, vi, beforeEach } from 'vitest';

import { libraryPaths } from '../src/library/libraryPaths';

// What the device holds (file uri → contents; every folder is taken to exist), the file-system calls
// made, and how the download and the `use` step end.
const disk = new Map<string, string>();
const fs: string[] = [];
const outcome: { download: 'ok' | Error; use: 'ok' | Error } = { download: 'ok', use: 'ok' };

vi.mock('expo-file-system', async () =>
  (await import('./helpers/fakeFileSystem')).fakeFileSystem({
    exists: (uri) => uri.endsWith('/') || disk.has(uri),
    read: (uri) => disk.get(uri)!,
    write: (uri, content) => {
      fs.push(`mark ${uri}`);
      disk.set(uri, content);
    },
    move: (from, to) => {
      fs.push(`move ${from} → ${to}`);
      disk.set(to, disk.get(from)!);
      disk.delete(from);
    },
    delete: (uri) => {
      fs.push(`delete ${uri}`);
      for (const key of disk.keys()) if (key === uri || (uri.endsWith('/') && key.startsWith(uri))) disk.delete(key);
    },
  }),
);
vi.mock('../src/utils/cloud-api/assets/getAssetFileDownloadUrlAsync', () => ({
  default: async () => {
    fs.push('ask the cloud');
    return 'https://s3/a.jpg';
  },
}));
vi.mock('../src/utils/cloud-api/assets/downloadAssetFileAsync', () => ({
  default: async ({ filename }: { filename: string }, _url: string, directory: string) => {
    if (outcome.download !== 'ok') throw outcome.download;
    fs.push(`download ${directory}${filename}`);
    disk.set(`${directory}${filename}`, 'bytes');
    return `${directory}${filename}`;
  },
}));

const { default: withAssetFileAsync } = await import('../src/utils/assets/files/withAssetFileAsync');

const library = libraryPaths('abc');
const FOLDER = 'file:///caches/downloads/abc/a.jpg/';
const MARK = `${FOLDER}last-used`;
const HOUR = 60 * 60 * 1000;
const run = (isAuthenticated = true) =>
  withAssetFileAsync(
    { filename: 'a.jpg', isFileSynced: true },
    { isAuthenticated, library, onProgress: () => {}, signal: new AbortController().signal },
    async (uri: string) => {
      if (outcome.use !== 'ok') throw outcome.use;
      fs.push(`use ${uri}`);
    },
  );

// A whole download of a.jpg, last used `ago` ms ago.
function keptDownload(ago: number) {
  disk.set(`${FOLDER}a.jpg`, 'bytes');
  disk.set(MARK, String(Date.now() - ago));
}

describe('withAssetFileAsync', () => {
  beforeEach(() => {
    disk.clear();
    fs.length = 0;
    outcome.download = 'ok';
    outcome.use = 'ok';
  });

  it("downloads into the asset's folder through partial/, keeps the file and marks it used", async () => {
    await run();
    expect(fs).toEqual([
      'ask the cloud',
      `download ${FOLDER}partial/a.jpg`,
      `move ${FOLDER}partial/a.jpg → ${FOLDER}a.jpg`,
      `delete ${FOLDER}partial/`,
      `mark ${MARK}`,
      `use ${FOLDER}a.jpg`,
    ]);
  });

  it('a failed or cancelled download deletes the folder, keeps the error and leaves nothing to reuse', async () => {
    outcome.download = Object.assign(new Error('cancelled'), { name: 'AbortError' });
    await expect(run()).rejects.toMatchObject({ name: 'AbortError' });
    expect(fs).toEqual(['ask the cloud', `delete ${FOLDER}`]);

    fs.length = 0;
    outcome.download = 'ok';
    await run();
    expect(fs[0]).toBe('ask the cloud');
  });

  it('a use that fails keeps its error, and the whole download for the next time', async () => {
    outcome.use = new Error('Share refused');
    await expect(run()).rejects.toThrow('Share refused');
    expect(disk.has(`${FOLDER}a.jpg`)).toBe(true);
  });

  it('a whole download used within a day is used again without asking the cloud, and marked used', async () => {
    keptDownload(23 * HOUR);
    await run();
    expect(fs).toEqual([`mark ${MARK}`, `use ${FOLDER}a.jpg`]);
  });

  it('a kept download is still used signed out', async () => {
    keptDownload(HOUR);
    await run(false);
    expect(fs.at(-1)).toBe(`use ${FOLDER}a.jpg`);
  });

  it('an incomplete download (still in partial/, no mark) is downloaded again', async () => {
    disk.set(`${FOLDER}partial/a.jpg`, 'by');
    await run();
    expect(fs.slice(0, 2)).toEqual(['ask the cloud', `download ${FOLDER}partial/a.jpg`]);
  });

  it('a download last used over a day ago is downloaded again', async () => {
    keptDownload(25 * HOUR);
    await run();
    expect(fs[0]).toBe('ask the cloud');
  });

  it('the original on the device comes first', async () => {
    keptDownload(HOUR);
    disk.set('file:///documents/libraries/abc/files/a.jpg', 'original');
    await run();
    expect(fs).toEqual(['use file:///documents/libraries/abc/files/a.jpg']);
  });

  it("a filename that isn't a plain file name downloads and deletes nothing outside its folder", async () => {
    const options = { isAuthenticated: true, library, onProgress: () => {}, signal: new AbortController().signal };
    await expect(withAssetFileAsync({ filename: '..', isFileSynced: true }, options, () => {})).rejects.toThrow(
      'Not a file name',
    );
    expect(fs.filter((call) => call.startsWith('download') || call.startsWith('delete'))).toEqual([]);
  });
});
