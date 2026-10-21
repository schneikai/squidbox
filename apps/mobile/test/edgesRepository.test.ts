import { and, eq, isNull } from 'drizzle-orm';
import { describe, it, expect, beforeEach } from 'vitest';

import { albumOrder } from './helpers/albumOrder';
import { makeTestDb } from './helpers/testDb';
import * as schema from '../src/sync/db/schema';
import type { SyncDb } from '../src/sync/db/types';
import { makeEdgeRepository } from '../src/sync/edgesRepository';
import { makeRepository } from '../src/sync/repository';

describe('edgesRepository (album_assets)', () => {
  const edges = makeEdgeRepository('album_assets', schema.albumAssets, 'albumId');
  let db: SyncDb;
  let n: number;
  const newId = () => `edge-${++n}`;
  const AL = 'album-1';

  beforeEach(() => {
    db = makeTestDb();
    n = 0;
  });

  async function order(): Promise<string[]> {
    return albumOrder(await db.select().from(schema.albumAssets), AL);
  }
  // The album's live edges in canonical order, one per asset, with their keys.
  async function liveEdges(): Promise<{ assetId: string; position: string; id: string }[]> {
    const rows = await db
      .select()
      .from(schema.albumAssets)
      .where(and(eq(schema.albumAssets.albumId, AL), isNull(schema.albumAssets.deletedAt)))
      .orderBy(schema.albumAssets.position, schema.albumAssets.id);
    return rows;
  }
  function edge(id: string, assetId: string, position: string) {
    return { id, createdAt: 1, updatedAt: 1, deletedAt: null, albumId: AL, assetId, position };
  }
  const albumEdgeRows = makeRepository('album_assets', schema.albumAssets);
  async function outboxCount(): Promise<number> {
    const rows = await db.select().from(schema.outbox).where(eq(schema.outbox.collection, 'album_assets'));
    return rows.length;
  }

  it('add appends in order, skips duplicates, and enqueues one outbox row per edge', async () => {
    await edges.add(db, AL, ['a', 'b', 'c'], newId);
    expect(await order()).toEqual(['a', 'b', 'c']);
    expect(await outboxCount()).toBe(3);

    await edges.add(db, AL, ['b', 'd'], newId); // b already present → only d added
    expect(await order()).toEqual(['a', 'b', 'c', 'd']);
    expect(await outboxCount()).toBe(4);
  });

  it('reorder rewrites positions to match the given order', async () => {
    await edges.add(db, AL, ['a', 'b', 'c'], newId);
    await edges.reorder(db, AL, ['c', 'a', 'b']);
    expect(await order()).toEqual(['c', 'a', 'b']);
  });

  it('reorder keeps the edges it was not given after the given order, and tombstones duplicates', async () => {
    await edges.add(db, AL, ['a', 'b', 'c', 'd'], newId);
    await albumEdgeRows.createMany(db, [edge('dup-b', 'b', 'z')]); // a second, later edge for b
    expect((await liveEdges()).map((e) => e.assetId)).toEqual(['a', 'b', 'c', 'd', 'b']);
    await edges.reorder(db, AL, ['c', 'a']); // the grid showed only c and a (b and d are, say, soft-deleted)
    const live = await liveEdges();
    expect(live.map((e) => e.assetId)).toEqual(['c', 'a', 'b', 'd']);
    expect(live.map((e) => e.id)).not.toContain('dup-b');
  });

  it('move writes one position between the row dropped after and the next live edge', async () => {
    await edges.add(db, AL, ['a', 'b', 'c', 'd'], newId);
    const before = await liveEdges();
    await edges.move(db, AL, 'd', 'a');
    const after = await liveEdges();
    expect(after.map((e) => e.assetId)).toEqual(['a', 'd', 'b', 'c']);
    // Only d's edge changed.
    expect(after.filter((e) => e.assetId !== 'd')).toEqual(before.filter((e) => e.assetId !== 'd'));

    await edges.move(db, AL, 'c', null); // to the front
    expect((await liveEdges()).map((e) => e.assetId)).toEqual(['c', 'a', 'd', 'b']);
    await edges.move(db, AL, 'a', 'b'); // to the end
    expect((await liveEdges()).map((e) => e.assetId)).toEqual(['c', 'd', 'b', 'a']);
  });

  it('move resolves the neighbors by (position, id) and tombstones duplicates of the moved asset', async () => {
    // Two offline devices appended b and c with the same key; a also has a duplicate edge.
    await albumEdgeRows.createMany(db, [
      edge('e-a', 'a', '1'),
      edge('e-b', 'b', '5'),
      edge('e-c', 'c', '5'),
      edge('e-d', 'd', '9'),
      edge('e-a2', 'a', '7'),
    ]);
    expect((await liveEdges()).map((e) => e.assetId)).toEqual(['a', 'b', 'c', 'a', 'd']);
    // (a) the row dropped after is b's earliest edge; (b) the next edge is c, by (position, id),
    // not d: a plain `position > ?` would skip c.
    await edges.move(db, AL, 'a', 'b');
    const live = await liveEdges();
    expect(live.map((e) => e.assetId)).toEqual(['b', 'a', 'c', 'd']);
    expect(live.map((e) => e.id)).not.toContain('e-a2');
  });

  it('move re-keys only the edges tied with the one dropped after when no key fits between', async () => {
    await albumEdgeRows.createMany(db, [
      edge('e-a', 'a', '1'),
      edge('e-b', 'b', '5'),
      edge('e-c', 'c', '5'),
      edge('e-a2', 'a', '7'), // a's duplicate, from a concurrent add on another device
      edge('e-d', 'd', '9'),
    ]);
    const before = await liveEdges();
    await edges.move(db, AL, 'd', 'b'); // between b ('5') and c ('5'): d and c go between '5' and '7'
    const live = await liveEdges();
    expect(await order()).toEqual(['a', 'b', 'd', 'c']);
    const untouched = (e: { id: string }) => ['e-a', 'e-b', 'e-a2'].includes(e.id);
    expect(live.filter(untouched)).toEqual(before.filter(untouched));
    expect(live.map((e) => e.id)).toEqual(['e-a', 'e-b', 'e-d', 'e-c', 'e-a2']);
  });

  it('move does nothing for an asset or a target that left the album meanwhile', async () => {
    await edges.add(db, AL, ['a', 'b'], newId);
    await edges.move(db, AL, 'gone', 'a');
    await edges.move(db, AL, 'b', 'gone');
    expect((await liveEdges()).map((e) => e.assetId)).toEqual(['a', 'b']);
    expect(await outboxCount()).toBe(2);
  });

  it('remove tombstones the edge (dropped from the ordered read)', async () => {
    await edges.add(db, AL, ['a', 'b', 'c'], newId);
    await edges.remove(db, AL, ['b']);
    expect(await order()).toEqual(['a', 'c']);
    // Re-adding b creates a fresh live edge again.
    await edges.add(db, AL, ['b'], newId);
    expect(await order()).toEqual(['a', 'c', 'b']);
  });

  it('tombstoneParent tombstones every live edge for the parent (album/post deleted)', async () => {
    await edges.add(db, AL, ['a', 'b', 'c'], newId);
    await edges.add(db, 'album-2', ['x'], newId); // a different album is untouched
    await edges.tombstoneParent(db, AL);
    expect(await order()).toEqual([]); // AL has no live edges
    const rows = await db.select().from(schema.albumAssets);
    expect(rows.filter((r) => r.albumId === AL).every((r) => r.deletedAt != null)).toBe(true);
    expect(albumOrder(rows, 'album-2')).toEqual(['x']); // other album intact
  });

  it('setRefs saves the list over its seed (add + remove + reorder in one)', async () => {
    const posts = makeEdgeRepository('post_assets', schema.postAssets, 'postId');
    await posts.createFromRefs(db, 'post-1', [
      { id: 'r1', assetId: 'a1' },
      { id: 'r2', assetId: 'a2' },
    ]);
    // Drop r1, keep r2, add r3 — and put r3 first.
    await posts.setRefs(
      db,
      'post-1',
      [
        { id: 'r3', assetId: 'a3' },
        { id: 'r2', assetId: 'a2' },
      ],
      [{ id: 'r1' }, { id: 'r2' }],
    );
    const rows = await db.select().from(schema.postAssets);
    const live = rows.filter((r) => r.deletedAt == null).sort((a, b) => (a.position < b.position ? -1 : 1));
    expect(live.map((r) => r.assetId)).toEqual(['a3', 'a2']);
    expect(rows.find((r) => r.id === 'r1')?.deletedAt).toBeTruthy(); // r1 tombstoned
  });

  it('setRefs restores an edge removed meanwhile as its next version, even if that removal looks newer', async () => {
    const posts = makeEdgeRepository('post_assets', schema.postAssets, 'postId');
    await posts.createFromRefs(db, 'post-1', [{ id: 'r1', assetId: 'a1' }]);
    // Another device removed r1, with a clock ahead of ours.
    const removedAt = Date.now() + 60_000;
    await db
      .update(schema.postAssets)
      .set({ deletedAt: removedAt, updatedAt: removedAt })
      .where(eq(schema.postAssets.id, 'r1'));

    await posts.setRefs(db, 'post-1', [{ id: 'r1', assetId: 'a1' }], [{ id: 'r1' }]);
    const r1 = (await db.select().from(schema.postAssets).where(eq(schema.postAssets.id, 'r1')))[0]!;
    expect(r1.deletedAt).toBeNull();
    expect(r1.updatedAt).toBeGreaterThan(removedAt); // wins LWW against the removal
  });

  it('setRefs keeps the live edges its seed didn’t have, after the list, and removes only those taken out', async () => {
    const posts = makeEdgeRepository('post_assets', schema.postAssets, 'postId');
    await posts.createFromRefs(db, 'post-1', [
      { id: 'r1', assetId: 'a1' },
      { id: 'r2', assetId: 'a2' },
    ]);
    const seed = [{ id: 'r1' }, { id: 'r2' }];
    await posts.add(db, 'post-1', ['a9'], () => 'r9'); // another device's, or hidden from the editor
    await posts.setRefs(
      db,
      'post-1',
      [
        { id: 'r2', assetId: 'a2' },
        { id: 'r3', assetId: 'a3' },
      ],
      seed,
    );
    const rows = await db.select().from(schema.postAssets);
    const live = rows.filter((r) => r.deletedAt == null).sort((a, b) => (a.position < b.position ? -1 : 1));
    expect(live.map((r) => r.assetId)).toEqual(['a2', 'a3', 'a9']);
  });

  it('creating edges with ids that already exist fails instead of moving them to another post', async () => {
    const posts = makeEdgeRepository('post_assets', schema.postAssets, 'postId');
    const refs = [{ id: 'r1', assetId: 'a1' }];
    await posts.createFromRefs(db, 'post-1', refs);
    await expect(posts.createFromRefs(db, 'post-2', refs)).rejects.toThrow();
    const rows = await db.select().from(schema.postAssets);
    expect(rows.map((r) => r.postId)).toEqual(['post-1']);
  });
});
