import { ASSET_TAG_LIMITS } from '@squidbox/shared';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { makeAlbumRecord, makeAssetRecord } from './helpers/factory';
import { makeMeasuredTestDb } from './helpers/testDb';
import saveAlbumTags from '../src/features/album-tags/saveAlbumTags';
import * as assets from '../src/sync/assetsRepository';
import * as schema from '../src/sync/db/schema';
import type { SyncDb } from '../src/sync/db/types';
import { makeEdgeRepository } from '../src/sync/edgesRepository';
import { clearOutboxRows } from '../src/sync/outbox';
import { readByIds } from '../src/sync/readByIds';
import { makeRepository } from '../src/sync/repository';

const albums = makeRepository('albums', schema.albums);
const albumAssets = makeEdgeRepository('album_assets', schema.albumAssets, 'albumId');

// An album `al1` holding photos with these tags, `p0`, `p1`…; the outbox cleared.
async function albumOf(tags: (string[] | null)[], { deleted = [] as number[] } = {}) {
  const measured = makeMeasuredTestDb();
  const { db } = measured;
  const ids = tags.map((_, i) => `p${i}`);
  await assets.createMany(
    db,
    tags.map((each, i) => makeAssetRecord({ id: ids[i], tags: each, deletedAt: deleted.includes(i) ? 5 : null })),
  );
  await albums.createMany(db, [makeAlbumRecord({ id: 'al1' })]);
  await albumAssets.createFromRefs(
    db,
    'al1',
    ids.map((assetId) => ({ id: `e-${assetId}`, assetId })),
  );
  await clearOutboxRows(db, 'assets', ids);
  return measured;
}

async function tagsOf(db: SyncDb, ids: string[]) {
  return (await readByIds(db, schema.assets, ids)).map((row) => row.tags);
}

const outboxIds = async (db: SyncDb) =>
  (await db.select().from(schema.outbox).where(eq(schema.outbox.collection, 'assets'))).map((row) => row.recordId);

describe('saveAlbumTags', () => {
  it('puts an added tag on every photo', async () => {
    const { db } = await albumOf([['fog'], null]);
    await saveAlbumTags(db, 'al1', { add: ['moss'], remove: [] });
    expect(await tagsOf(db, ['p0', 'p1'])).toEqual([['fog', 'moss'], ['moss']]);
  });

  it('takes a removed tag off every photo and keeps the others', async () => {
    const { db } = await albumOf([
      ['fog', 'moss'],
      ['Moss', 'creek'],
    ]);
    await saveAlbumTags(db, 'al1', { add: [], remove: ['moss'] });
    expect(await tagsOf(db, ['p0', 'p1'])).toEqual([['fog'], ['creek']]);
  });

  it('keeps a tag stored on a photo after the sheet opened', async () => {
    const { db } = await albumOf([['fog'], ['fog']]);
    await assets.setTags(db, 'p1', ['fog', 'lake']);
    await saveAlbumTags(db, 'al1', { add: ['moss'], remove: [] });
    expect(await tagsOf(db, ['p0', 'p1'])).toEqual([
      ['fog', 'moss'],
      ['fog', 'lake', 'moss'],
    ]);
  });

  it('leaves a never-tagged photo untagged when tags are only taken off', async () => {
    const { db } = await albumOf([['fog'], null]);
    await saveAlbumTags(db, 'al1', { add: [], remove: ['fog'] });
    expect(await tagsOf(db, ['p0', 'p1'])).toEqual([[], null]);
    expect(await outboxIds(db)).toEqual(['p0']);
  });

  it('skips a full photo for an added tag, keeping its own tags', async () => {
    const full = Array.from({ length: ASSET_TAG_LIMITS.tags }, (_, i) => `t${i}`);
    const { db } = await albumOf([full, ['fog']]);
    await saveAlbumTags(db, 'al1', { add: ['moss'], remove: [] });
    expect(await tagsOf(db, ['p0', 'p1'])).toEqual([full, ['fog', 'moss']]);
  });

  it('writes nothing to a deleted photo', async () => {
    const { db } = await albumOf([['fog'], ['fog']], { deleted: [1] });
    await saveAlbumTags(db, 'al1', { add: ['moss'], remove: [] });
    expect(await tagsOf(db, ['p1'])).toEqual([['fog']]);
    expect(await outboxIds(db)).toEqual(['p0']);
  });

  it('throws when the album was deleted', async () => {
    const { db } = await albumOf([['fog']]);
    await albums.remove(db, ['al1']);
    await expect(saveAlbumTags(db, 'al1', { add: ['moss'], remove: [] })).rejects.toThrow('This album was deleted');
  });

  it('runs as many statements however many photos it leaves as they were, and queues only the changed ones', async () => {
    const statements = async (unchanged: number) => {
      const { db, measure } = await albumOf([['fog'], ...Array.from({ length: unchanged }, () => ['fog', 'moss'])]);
      const work = await measure(() => saveAlbumTags(db, 'al1', { add: ['moss'], remove: [] }));
      expect(await outboxIds(db)).toEqual(['p0']);
      return work.statements;
    };
    expect(await statements(30)).toBe(await statements(2));
  });
});
