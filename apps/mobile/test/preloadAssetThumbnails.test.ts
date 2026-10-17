import { describe, it, expect, vi, beforeEach } from 'vitest';

import { libraryPaths } from '../src/library/libraryPaths';

// The files on the device, the downloads running (each until the test ends it) and the most at once.
const files = new Set<string>();
const downloads: { name: string; end(status: number | Error): void }[] = [];
const peak = { running: 0, most: 0 };

vi.mock('../src/library/current', () => ({ getLibrary: () => libraryPaths('abc') }));
vi.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///documents/',
  getInfoAsync: async (uri: string) => ({ exists: files.has(uri) }),
  downloadAsync: (url: string, uri: string) => {
    peak.running += 1;
    peak.most = Math.max(peak.most, peak.running);
    return new Promise((resolve, reject) => {
      downloads.push({
        name: url,
        end: (status) => {
          peak.running -= 1;
          files.add(uri); // an error response is written too
          if (status instanceof Error) reject(status);
          else resolve({ status });
        },
      });
    });
  },
  deleteAsync: async (uri: string) => {
    if (uri.includes('undeletable')) throw new Error('busy');
    files.delete(uri);
  },
}));
vi.mock('../src/utils/cloud-api/assets/getAssetFileDownloadUrlsAsync', () => ({
  default: async (names: string[]) => names.map((name) => [name, name]),
}));

const { default: preloadAssetThumbnailsAsync } =
  await import('../src/features/cloud/assets/preloadAssetThumbnailsAsync');
const { default: preloadOnWeb } = await import('../src/features/cloud/assets/preloadAssetThumbnailsAsync.web');
const { default: webThumbnailUrls } = await import('../src/utils/assets/thumbnails/webThumbnailUrls');

const thumbnails = 'file:///documents/libraries/abc/thumbnails/';
const assetsOf = (...names: string[]) => names.map((thumbnailFilename) => ({ thumbnailFilename }));
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

// Ends each download as it starts, by its name (a status, or an error thrown), until `result` settles.
async function endAll<T>(result: Promise<T>, outcome: (name: string) => number | Error): Promise<T> {
  let isSettled = false;
  result.finally(() => (isSettled = true));
  for (let ended = 0; !isSettled;) {
    await flush();
    while (ended < downloads.length) downloads[ended]!.end(outcome(downloads[ended++]!.name));
  }
  return result;
}

describe('preloadAssetThumbnailsAsync', () => {
  beforeEach(() => {
    files.clear();
    downloads.length = 0;
    peak.most = 0;
    webThumbnailUrls.clear();
  });

  it('resolves the ones it has afterwards, three downloads at a time; a failed one leaves the others be', async () => {
    files.add(`${thumbnails}here.jpg`);
    const names = [
      'here.jpg',
      'gone.jpg',
      'offline.jpg',
      'undeletable.jpg',
      ...['a', 'b', 'c', 'd'].map((n) => `${n}.jpg`),
    ];
    const result = preloadAssetThumbnailsAsync(assetsOf(...names));
    const outcome = (name: string) =>
      name === 'offline.jpg' ? new Error('offline') : name.match(/gone|undeletable/) ? 404 : 200;

    expect(await endAll(result, outcome)).toEqual(new Set(['here.jpg', 'a.jpg', 'b.jpg', 'c.jpg', 'd.jpg']));
    expect(peak.most).toBe(3);
    expect(files.has(`${thumbnails}gone.jpg`)).toBe(false); // no error page passing for a thumbnail
  });

  it('starts no new download once aborted', async () => {
    const controller = new AbortController();
    const result = preloadAssetThumbnailsAsync(
      assetsOf('a.jpg', 'b.jpg', 'c.jpg', 'd.jpg', 'e.jpg'),
      controller.signal,
    );
    await flush();
    controller.abort();
    expect(await endAll(result, () => 200)).toEqual(new Set(['a.jpg', 'b.jpg', 'c.jpg']));
    expect(downloads).toHaveLength(3);
  });

  it('on web, keeps the URLs it got, and none once aborted', async () => {
    webThumbnailUrls.set('here.jpg', 'url');
    expect(await preloadOnWeb(assetsOf('here.jpg', 'new.jpg'))).toEqual(new Set(['here.jpg', 'new.jpg']));

    const controller = new AbortController();
    const result = preloadOnWeb(assetsOf('late.jpg'), controller.signal);
    controller.abort();
    expect(await result).toEqual(new Set());
    expect(webThumbnailUrls.has('late.jpg')).toBe(false);
  });
});
