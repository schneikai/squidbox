import { describe, it, expect, beforeEach } from 'vitest';

import { createPost, makeAlbumRecord, makeAssetRecord } from './helpers/factory';
import { makeTestDb } from './helpers/testDb';
import readLastPosted from '../src/features/post-random-suggestions/readLastPosted';
import * as repo from '../src/sync/assetsRepository';
import type { AppDb } from '../src/sync/db/driver';
import * as schema from '../src/sync/db/schema';
import { makeEdgeRepository } from '../src/sync/edgesRepository';
import { makeRepository } from '../src/sync/repository';

const albums = makeRepository('albums', schema.albums);
const albumEdges = makeEdgeRepository('album_assets', schema.albumAssets, 'albumId');

let db: AppDb;
let n: number;
const newId = () => `id-${++n}`;
beforeEach(async () => {
  db = makeTestDb();
  n = 0;
  await repo.createAssets(
    db,
    ['asset-0', 'asset-1', 'asset-2'].map((id) => makeAssetRecord({ id })),
  );
  await albums.createMany(db, [
    makeAlbumRecord({ id: 'beach', name: 'Beach', position: 'b' }),
    makeAlbumRecord({ id: 'city', name: 'City', position: 'a' }),
  ]);
});

describe('readLastPosted', () => {
  it('reads when the asset and the most recently posted of its albums were last posted', async () => {
    await albumEdges.add(db, 'beach', ['asset-0', 'asset-1'], newId);
    await albumEdges.add(db, 'city', ['asset-0', 'asset-2'], newId);
    await createPost(db, { postedAt: 10 }, ['asset-0']);
    await createPost(db, { postedAt: 30 }, ['asset-1']);
    await createPost(db, { postedAt: 20 }, ['asset-2']);
    await createPost(db, { postedAt: 99, deletedAt: 5 }, ['asset-0']); // deleted: doesn't count
    expect(await readLastPosted(db, 'asset-0')).toEqual({
      lastPostedAt: 10,
      album: { name: 'Beach', lastPostedAt: 30 },
    });
  });

  it('reads a never posted asset, and the first album in custom order when none was posted', async () => {
    await albumEdges.add(db, 'beach', ['asset-0'], newId);
    await albumEdges.add(db, 'city', ['asset-0'], newId);
    expect(await readLastPosted(db, 'asset-0')).toEqual({
      lastPostedAt: null,
      album: { name: 'City', lastPostedAt: null },
    });
  });

  it('skips an album the asset was removed from and a deleted album', async () => {
    await albumEdges.add(db, 'beach', ['asset-0', 'asset-1'], newId);
    await albumEdges.add(db, 'city', ['asset-0', 'asset-2'], newId);
    await createPost(db, { postedAt: 30 }, ['asset-1']);
    await createPost(db, { postedAt: 20 }, ['asset-2']);
    await albumEdges.remove(db, 'beach', ['asset-0']);
    expect((await readLastPosted(db, 'asset-0')).album).toEqual({ name: 'City', lastPostedAt: 20 });
    await albums.update(db, 'city', { deletedAt: 5 });
    expect((await readLastPosted(db, 'asset-0')).album).toBeNull();
  });

  it('reads no album for an asset in none', async () => {
    await createPost(db, { postedAt: 10 }, ['asset-0']);
    expect(await readLastPosted(db, 'asset-0')).toEqual({ lastPostedAt: 10, album: null });
  });
});
