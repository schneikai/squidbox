import { describe, it, expect, vi, beforeEach } from 'vitest';

import { libraryPaths } from '../src/library/libraryPaths';

// The files on the device, and the thumbnails being made (each until the test finishes it).
const files = new Set<string>();
const making: { uri: string; finish(): void; fail(error: Error): void }[] = [];

vi.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///documents/',
  getInfoAsync: async (uri: string) => ({ exists: files.has(uri) }),
  moveAsync: async ({ from, to }: { from: string; to: string }) => {
    files.delete(from);
    files.add(to);
  },
  deleteAsync: async () => {},
}));
vi.mock('../src/utils/thumbnails/createThumbnail', () => ({
  default: (uri: string) =>
    new Promise<string>((resolve, reject) => {
      const temp = `file:///caches/${uri.split('/').pop()}.jpg`;
      const finish = () => {
        files.add(temp);
        resolve(temp);
      };
      making.push({ uri, finish, fail: reject });
    }),
}));

const { default: ensureAssetThumbnailAsync } = await import('../src/utils/assets/thumbnails/ensureAssetThumbnailAsync');
const { default: getAssetThumbnailStatusAsync } =
  await import('../src/utils/assets/thumbnails/getAssetThumbnailStatusAsync');

const library = libraryPaths('abc');
const dir = 'file:///documents/libraries/abc/';
const assetOf = (id: string) => ({
  id,
  filename: `${id}.mov`,
  thumbnailFilename: `${id}-thumb.png`,
  mediaType: 'video',
});
const withOriginal = (id: string) => {
  files.add(`${dir}files/${id}.mov`);
  return assetOf(id);
};
const hasThumbnail = (id: string) => files.has(`${dir}thumbnails/${id}-thumb.png`);
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('ensureAssetThumbnailAsync', () => {
  beforeEach(() => {
    files.clear();
    making.length = 0;
  });

  it('leaves a thumbnail on the device as it is, and has none to make without the original', async () => {
    files.add(`${dir}thumbnails/a-thumb.png`);
    expect(await ensureAssetThumbnailAsync(assetOf('a'), { library })).toBe(true);
    expect(await ensureAssetThumbnailAsync(assetOf('b'), { library })).toBe(false);
    expect(making).toHaveLength(0);
  });

  it('makes a missing thumbnail again from the original, under its name, once for callers at the same time', async () => {
    const asset = withOriginal('a');
    const both = Promise.all([
      ensureAssetThumbnailAsync(asset, { library }),
      ensureAssetThumbnailAsync(asset, { library }),
    ]);
    await flush();
    expect(making).toHaveLength(1);
    making[0]!.finish();
    expect(await both).toEqual([true, true]);
    expect(hasThumbnail('a')).toBe(true);
  });

  it('makes two at once, the newest asked for first, and skips one whose tile left before its turn', async () => {
    const tile = new AbortController();
    const results = ['a', 'b', 'c', 'd'].map((id) =>
      ensureAssetThumbnailAsync(withOriginal(id), id === 'c' ? { library, signal: tile.signal } : { library }),
    );
    await flush();
    expect(making.map((job) => job.uri.split('/').pop())).toEqual(['a.mov', 'b.mov']);
    tile.abort();
    making[0]!.finish();
    await flush();
    expect(making.map((job) => job.uri.split('/').pop())).toEqual(['a.mov', 'b.mov', 'd.mov']);
    making[1]!.finish();
    making[2]!.finish();
    expect(await Promise.all(results)).toEqual([true, true, false, true]);
    expect(hasThumbnail('c')).toBe(false);
  });

  it('checks for the original when its turn comes: the backup may have deleted it meanwhile', async () => {
    const [a, b, c] = ['a', 'b', 'c'].map(withOriginal);
    const results = [ensureAssetThumbnailAsync(a!, { library }), ensureAssetThumbnailAsync(b!, { library })];
    await flush();
    const late = ensureAssetThumbnailAsync(c!, { library });
    files.delete(`${dir}files/c.mov`);
    making[0]!.finish();
    making[1]!.finish();
    expect(await late).toBe(false);
    expect(await Promise.all(results)).toEqual([true, true]);
  });

  it('lets an own asset’s tile show the thumbnail made again, and one that fails says "not uploaded"', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const own = { ...withOriginal('a'), isThumbnailSynced: false };
    const status = getAssetThumbnailStatusAsync(own, { isAuthenticated: true, library });
    await flush();
    making[0]!.finish();
    expect(await status).toBe('local');

    const broken = { ...withOriginal('b'), isThumbnailSynced: false };
    for (let attempt = 0; attempt < 2; attempt++) {
      const failing = getAssetThumbnailStatusAsync(broken, { isAuthenticated: true, library });
      await flush();
      making.at(-1)!.fail(new Error('unreadable video'));
      expect(await failing).toBe('notUploaded');
    }
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});
