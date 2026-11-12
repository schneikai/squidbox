import { describe, it, expect, vi, beforeEach } from 'vitest';

import { libraryPaths } from '../src/library/libraryPaths';

const DOWNLOADS = 'file:///caches/downloads/abc/';
const HOUR = 60 * 60 * 1000;
// The downloads folder's entries, the last-used marks by uri, and what got deleted.
let entries: string[] = [];
const marks = new Map<string, string>();
const deleted: string[] = [];

vi.mock('expo-file-system', async () =>
  (await import('./helpers/fakeFileSystem')).fakeFileSystem({
    exists: (uri) => uri === DOWNLOADS || entries.some((name) => uri === `${DOWNLOADS}${name}`) || marks.has(uri),
    list: () => entries,
    read: (uri) => marks.get(uri)!,
    delete: (uri) => deleted.push(uri),
  }),
);

const { default: deleteStaleDownloadsAsync } = await import('../src/utils/assets/files/deleteStaleDownloadsAsync');

// A download folder named `name`, last used `ago` ms ago.
function folder(name: string, ago?: number) {
  entries.push(name);
  if (ago !== undefined) marks.set(`${DOWNLOADS}${name}/last-used`, String(Date.now() - ago));
}

describe('deleteStaleDownloadsAsync', () => {
  beforeEach(() => {
    entries = [];
    marks.clear();
    deleted.length = 0;
  });

  it('keeps a download used within a day', async () => {
    folder('a.jpg', 23 * HOUR);
    await deleteStaleDownloadsAsync(libraryPaths('abc'));
    expect(deleted).toEqual([]);
  });

  it('deletes one last used over a day ago, one never marked (cut off), a stray file and an old uuid folder', async () => {
    folder('stale.jpg', 25 * HOUR);
    folder('cut-off.jpg');
    folder('stray.txt');
    folder('old.jpg-3f2a0000-0000-4000-8000-000000000001');
    await deleteStaleDownloadsAsync(libraryPaths('abc'));
    expect(deleted).toEqual(entries.map((name) => `${DOWNLOADS}${name}`));
  });
});
