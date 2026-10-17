import { initialKeys, keysBetween, movePositions } from '@squidbox/shared';
import { eq } from 'drizzle-orm';
import { describe, it, expect } from 'vitest';

import { makeTestDb } from './helpers/testDb';
import sortAlbumsByCustomOrder from '../src/features/album-list/actions/sort-albums-action/sortAlbumsByCustomOrder';
import moveAlbum from '../src/features/albums-context/moveAlbum';
import * as schema from '../src/sync/db/schema';
import { makeRepository } from '../src/sync/repository';

type Album = { id: string; createdAt: number; position: string | null };

const [k1, k2, k3, k4] = initialKeys(4) as [string, string, string, string];
// a b c d, all placed.
const placed: Album[] = [
  { id: 'a', createdAt: 1, position: k1 },
  { id: 'b', createdAt: 2, position: k2 },
  { id: 'c', createdAt: 3, position: k3 },
  { id: 'd', createdAt: 4, position: k4 },
];
// n2 n1 (never placed, newest first), then a b.
const withNew: Album[] = [
  { id: 'n1', createdAt: 10, position: null },
  { id: 'n2', createdAt: 11, position: null },
  placed[0]!,
  placed[1]!,
];

function moved(albums: Album[], id: string, afterId: string | null) {
  const sorted = [...albums].sort(sortAlbumsByCustomOrder);
  const updates = movePositions(sorted, id, afterId);
  const next = sorted.map((album) => ({ ...album, ...updates[album.id] }));
  return { written: Object.keys(updates).sort(), order: next.sort(sortAlbumsByCustomOrder).map((album) => album.id) };
}

describe('movePositions', () => {
  it('gives only the moved item a key between its new neighbors', () => {
    expect(moved(placed, 'd', 'a')).toEqual({ written: ['d'], order: ['a', 'd', 'b', 'c'] });
    expect(moved(placed, 'a', 'd')).toEqual({ written: ['a'], order: ['b', 'c', 'd', 'a'] });
    expect(moved(placed, 'c', null)).toEqual({ written: ['c'], order: ['c', 'a', 'b', 'd'] });
  });

  it('places a never-placed item among the placed ones, the others staying unplaced in front', () => {
    expect(moved(withNew, 'n2', 'a')).toEqual({ written: ['n2'], order: ['n1', 'a', 'n2', 'b'] });
  });

  it('also places the never-placed items that end up after the moved one, which would sort first', () => {
    expect(moved(withNew, 'b', null)).toEqual({ written: ['b', 'n1', 'n2'], order: ['b', 'n2', 'n1', 'a'] });
    expect(moved(withNew, 'b', 'n2')).toEqual({ written: ['b', 'n1'], order: ['n2', 'b', 'n1', 'a'] });
  });

  it('re-keys only the items tied with the one dropped after, up to the next key', () => {
    const tied: Album[] = [
      { id: 'a', createdAt: 1, position: k1 },
      { id: 'b', createdAt: 2, position: k2 },
      { id: 'c', createdAt: 3, position: k2 },
      { id: 'e', createdAt: 5, position: k2 },
      { id: 'd', createdAt: 4, position: k3 },
    ];
    expect(moved(tied, 'd', 'b')).toEqual({ written: ['c', 'd', 'e'], order: ['a', 'b', 'd', 'c', 'e'] });
  });

  it('spreads the keys of a re-keyed run between its bounds, so they stay short', () => {
    const run: Album[] = Array.from({ length: 200 }, (_, i) => ({ id: `n${i}`, createdAt: 1000 - i, position: null }));
    const { written, order } = moved([...run, placed[0]!], 'a', null);
    expect(written).toHaveLength(201);
    expect(order).toEqual(['a', ...run.map((album) => album.id)]);
    const keys = Object.values(movePositions([...run, placed[0]!], 'a', null)).map((update) => update.position);
    expect(Math.max(...keys.map((key) => key.length))).toBeLessThanOrEqual(6);
  });

  it('needs only the neighbors, with the moved item anywhere among them', () => {
    expect(movePositions([placed[1]!, placed[2]!, placed[0]!], 'a', 'b')).toEqual({
      a: { position: expect.any(String) },
    });
  });

  it('changes nothing for an item or afterId that is gone', () => {
    expect(movePositions(placed, 'x', 'a')).toEqual({});
    expect(movePositions(placed, 'a', 'x')).toEqual({});
  });
});

describe('keysBetween', () => {
  it('gives n increasing keys strictly between the bounds, either of which may be open', () => {
    for (const [a, b] of [
      [k1, k2],
      [null, k1],
      [k4, null],
      [null, null],
    ] as const) {
      const keys = keysBetween(a, b, 50);
      expect(keys).toHaveLength(50);
      expect([...keys].sort()).toEqual(keys);
      expect(new Set(keys).size).toBe(50);
      if (a !== null) expect(keys[0]! > a).toBe(true);
      if (b !== null) expect(keys[49]! < b).toBe(true);
    }
  });
});

describe('moveAlbum', () => {
  it('writes only the moved album through the albums repository, so it lands in the outbox, skipping deleted ones', async () => {
    const db = makeTestDb();
    const albums = makeRepository('albums', schema.albums);
    const album = (id: string, position: string | null) => ({
      id,
      createdAt: 1,
      updatedAt: 1,
      deletedAt: null,
      name: id,
      isFavorite: false,
      position,
    });
    await albums.createMany(db, [album('a', k1), album('b', k2), album('c', k3), album('gone', null)]);
    await albums.remove(db, ['gone']);
    await db.delete(schema.outbox);

    // A deleted, never-placed album would otherwise sort first and need a key.
    await moveAlbum(db, albums, { id: 'c', afterId: null });
    await moveAlbum(db, albums, { id: 'a', afterId: 'gone' });

    const rows = await db.select().from(schema.albums);
    const live = rows.filter((row) => row.deletedAt === null).sort(sortAlbumsByCustomOrder);
    expect(live.map((row) => row.id)).toEqual(['c', 'a', 'b']);
    const outbox = await db.select().from(schema.outbox).where(eq(schema.outbox.collection, 'albums'));
    expect(outbox.map((row) => row.recordId)).toEqual(['c']);
  });

  it('resolves to the count that includes its own write, even when another write commits right after', async () => {
    const db = makeTestDb();
    const albums = makeRepository('albums', schema.albums);
    const album = (id: string, position: string) => ({
      id,
      createdAt: 1,
      updatedAt: 1,
      deletedAt: null,
      name: id,
      isFavorite: false,
      position,
    });
    await albums.createMany(db, [album('a', k1), album('b', k2)]);
    const before = db.committedWrites();
    const moving = moveAlbum(db, albums, { id: 'b', afterId: null });
    const other = albums.update(db, 'a', { name: 'renamed' }); // queued right behind the move
    expect(await moving).toBe(before + 1);
    await other;
    expect(db.committedWrites()).toBe(before + 2);
  });
});
