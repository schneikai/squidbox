import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, it, expect, vi } from 'vitest';

import { makeAlbumRecord } from './helpers/factory';
import { makeTestDb } from './helpers/testDb';
import useAlbum from '../src/features/album-detail/useAlbum';
import * as schema from '../src/sync/db/schema';
import { makeRepository } from '../src/sync/repository';

// The live hook needs the app database and Expo Router, which don't load in node; it is
// replaced by what it would return, and the read it is handed runs against a test database.
const liveQuery = vi.hoisted(() => vi.fn());
vi.mock('../src/sync/useLiveQuery', () => ({ useLiveQuery: liveQuery }));
vi.mock('../src/sync/db/client', async () => ({ schema: await import('../src/sync/db/schema') }));

const albums = makeRepository('albums', schema.albums);

function renderUseAlbum(albumId: string | undefined) {
  let album: unknown;
  function Probe() {
    album = useAlbum(albumId);
    return null;
  }
  renderToString(createElement(Probe));
  return album;
}

describe('useAlbum', () => {
  it('reads the album, or null when it is missing or deleted', async () => {
    const db = makeTestDb();
    await albums.createMany(db, [
      makeAlbumRecord({ id: 'live', name: 'Beach' }),
      makeAlbumRecord({ id: 'gone', deletedAt: 5 }),
    ]);
    liveQuery.mockReturnValue(undefined);
    const readOf = (albumId: string | undefined) => {
      renderUseAlbum(albumId);
      return liveQuery.mock.lastCall![0](db);
    };

    expect(await readOf('live')).toEqual({ id: 'live', record: expect.objectContaining({ name: 'Beach' }) });
    expect(await readOf('gone')).toEqual({ id: 'gone', record: null });
    expect(await readOf('missing')).toEqual({ id: 'missing', record: null });
    expect(await readOf(undefined)).toEqual({ id: undefined, record: null });
  });

  it("is undefined until its album is read, not the previous album's", () => {
    const album = makeAlbumRecord({ id: 'a' });
    liveQuery.mockReturnValue(undefined);
    expect(renderUseAlbum('a')).toBeUndefined();
    expect(renderUseAlbum(undefined)).toBeUndefined(); // no album asked for, nothing read yet

    liveQuery.mockReturnValue({ id: 'a', record: album });
    expect(renderUseAlbum('a')).toBe(album);
    expect(renderUseAlbum('b')).toBeUndefined();

    liveQuery.mockReturnValue({ id: 'b', record: null });
    expect(renderUseAlbum('b')).toBeNull();
    expect(renderUseAlbum(undefined)).toBeUndefined();
  });
});
