import { keyBetween } from '@squidbox/shared';
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
      [
        { id: 'r1', assetId: 'a1' },
        { id: 'r2', assetId: 'a2' },
      ],
    );
    const rows = await db.select().from(schema.postAssets);
    const live = rows.filter((r) => r.deletedAt == null).sort((a, b) => (a.position < b.position ? -1 : 1));
    expect(live.map((r) => r.assetId)).toEqual(['a3', 'a2']);
    expect(rows.find((r) => r.id === 'r1')?.deletedAt).toBeTruthy(); // r1 tombstoned
  });

  it('setRefs keeps out a seed edge removed meanwhile, and restores one the user added back as its next version', async () => {
    const posts = makeEdgeRepository('post_assets', schema.postAssets, 'postId');
    await posts.createFromRefs(db, 'post-1', [{ id: 'r1', assetId: 'a1' }]);
    // Another device removed r1, with a clock ahead of ours.
    const removedAt = Date.now() + 60_000;
    await db
      .update(schema.postAssets)
      .set({ deletedAt: removedAt, updatedAt: removedAt })
      .where(eq(schema.postAssets.id, 'r1'));
    const r1 = async () => (await db.select().from(schema.postAssets).where(eq(schema.postAssets.id, 'r1')))[0]!;

    // The editor was seeded with r1 and the user kept it: the other device's removal stands.
    await posts.setRefs(db, 'post-1', [{ id: 'r1', assetId: 'a1' }], [{ id: 'r1', assetId: 'a1' }]);
    expect((await r1()).deletedAt).toBe(removedAt);
    // Added back to an editor that didn't have it: restored, winning LWW against the removal.
    await posts.setRefs(db, 'post-1', [{ id: 'r1', assetId: 'a1' }], []);
    expect((await r1()).deletedAt).toBeNull();
    expect((await r1()).updatedAt).toBeGreaterThan(removedAt);
  });

  it('setRefs gives new keys only to the listed edges out of order: the others keep their places', async () => {
    const posts = makeEdgeRepository('post_assets', schema.postAssets, 'postId');
    await posts.createFromRefs(db, 'post-1', [
      { id: 'r1', assetId: 'a1' },
      { id: 'r2', assetId: 'a2' },
      { id: 'r3', assetId: 'a3' },
    ]);
    const before = new Map((await db.select().from(schema.postAssets)).map((r) => [r.id, r.position]));
    // A photo hidden from the editor (its purge waits) between a1 and a2.
    await db.insert(schema.postAssets).values({
      id: 'rh',
      createdAt: 1,
      updatedAt: 1,
      deletedAt: null,
      postId: 'post-1',
      assetId: 'ah',
      position: keyBetween(before.get('r1')!, before.get('r2')!),
    });
    const seed = [
      { id: 'r1', assetId: 'a1' },
      { id: 'r2', assetId: 'a2' },
      { id: 'r3', assetId: 'a3' },
    ];
    await posts.setRefs(db, 'post-1', [seed[0]!, seed[2]!, seed[1]!], seed); // a3 moved before a2
    const rows = await db.select().from(schema.postAssets);
    const live = rows.filter((r) => r.deletedAt == null).sort((a, b) => (a.position < b.position ? -1 : 1));
    expect(live.map((r) => r.assetId).filter((id) => id !== 'ah')).toEqual(['a1', 'a3', 'a2']);
    const after = new Map(rows.map((r) => [r.id, r.position]));
    expect(after.get('rh')).toBe(keyBetween(before.get('r1')!, before.get('r2')!)); // where it was
    expect(after.get('r1')).toBe(before.get('r1'));
    expect(rows.filter((r) => r.position !== (before.get(r.id) ?? r.position)).map((r) => r.id)).toHaveLength(1);
  });

  it('setRefs keeps the live edges its seed didn’t have, where they are, and removes only those taken out', async () => {
    const posts = makeEdgeRepository('post_assets', schema.postAssets, 'postId');
    await posts.createFromRefs(db, 'post-1', [
      { id: 'r1', assetId: 'a1' },
      { id: 'r2', assetId: 'a2' },
    ]);
    const seed = [
      { id: 'r1', assetId: 'a1' },
      { id: 'r2', assetId: 'a2' },
    ];
    await posts.add(db, 'post-1', ['a9'], () => 'r9'); // another device's, or hidden from the editor
    const a9 = (await db.select().from(schema.postAssets).where(eq(schema.postAssets.id, 'r9')))[0]!;
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
    expect(live.map((r) => r.assetId).filter((id) => id !== 'a9')).toEqual(['a2', 'a3']);
    expect(rows.find((r) => r.id === 'r9')).toEqual(a9); // untouched, where it was
  });

  // The user's moves are read against the seed: a reorder another device made while the editor was
  // open (synced in before the save) stays, and the photo the user added goes after the listed ones.
  it('setRefs keeps a reorder made elsewhere while the editor was open, re-keying only what the user moved', async () => {
    const posts = makeEdgeRepository('post_assets', schema.postAssets, 'postId');
    const seed = [
      { id: 'r1', assetId: 'a1' },
      { id: 'r2', assetId: 'a2' },
      { id: 'r3', assetId: 'a3' },
    ];
    await posts.createFromRefs(db, 'post-1', seed);
    await posts.move(db, 'post-1', 'a3', null); // another device's, synced in
    const before = new Map((await db.select().from(schema.postAssets)).map((r) => [r.id, r.position]));
    await posts.setRefs(db, 'post-1', [...seed, { id: 'r4', assetId: 'a4' }], seed);
    const rows = await db.select().from(schema.postAssets);
    const live = rows.filter((r) => r.deletedAt == null).sort((a, b) => (a.position < b.position ? -1 : 1));
    expect(live.map((r) => r.assetId)).toEqual(['a3', 'a1', 'a2', 'a4']);
    for (const id of ['r1', 'r2', 'r3']) expect(rows.find((r) => r.id === id)!.position).toBe(before.get(id));
  });

  it('setRefs tombstones the duplicate edges of a photo the user moved, as a reorder does', async () => {
    const posts = makeEdgeRepository('post_assets', schema.postAssets, 'postId');
    const seed = [
      { id: 'r1', assetId: 'a1' },
      { id: 'r2', assetId: 'a2' },
      { id: 'r3', assetId: 'a3' },
    ];
    await posts.createFromRefs(db, 'post-1', seed);
    // A concurrent offline add of a1 on another device left a second live edge, early in the post.
    await db.insert(schema.postAssets).values({
      id: 'rd',
      createdAt: 1,
      updatedAt: 1,
      deletedAt: null,
      postId: 'post-1',
      assetId: 'a1',
      position: '0',
    });
    await posts.setRefs(db, 'post-1', [seed[1]!, seed[2]!, seed[0]!], seed); // a1 moved to the end
    const rows = await db.select().from(schema.postAssets);
    const live = rows.filter((r) => r.deletedAt == null).sort((a, b) => (a.position < b.position ? -1 : 1));
    expect(live.map((r) => r.id)).toEqual(['r2', 'r3', 'r1']);
  });

  // Round 9: two photos tied at one key (two devices appended one each offline, `keysBetween(last,
  // null)` is deterministic) show in id order. The user puts a new photo between them in the editor:
  // it should land between them (move() re-keys the tied edges after the one dropped after), but it
  // gets a key after both: kept [k1, k, -, k], the run's next kept key k isn't above the highest
  // kept key k, so it goes after the next live key above k (none): after a3.
  it.fails('setRefs puts a photo added between two tied photos between them', async () => {
    const posts = makeEdgeRepository('post_assets', schema.postAssets, 'postId');
    await posts.createFromRefs(db, 'post-1', [{ id: 'r1', assetId: 'a1' }]);
    const k1 = (await db.select().from(schema.postAssets))[0]!.position;
    const tied = keyBetween(k1, null);
    for (const [id, assetId] of [
      ['r2', 'a2'],
      ['r3', 'a3'],
    ])
      await db.insert(schema.postAssets).values({
        ...{ id, assetId, postId: 'post-1', position: tied },
        ...{ createdAt: 1, updatedAt: 1, deletedAt: null },
      });
    const seed = [
      { id: 'r1', assetId: 'a1' },
      { id: 'r2', assetId: 'a2' },
      { id: 'r3', assetId: 'a3' },
    ];
    await posts.setRefs(db, 'post-1', [seed[0]!, seed[1]!, { id: 'rx', assetId: 'ax' }, seed[2]!], seed);
    const rows = await db.select().from(schema.postAssets);
    const live = rows
      .filter((r) => r.deletedAt == null)
      .sort((a, b) => (a.position < b.position || (a.position === b.position && a.id < b.id) ? -1 : 1));
    expect(live.map((r) => r.assetId)).toEqual(['a1', 'a2', 'ax', 'a3']); // actual: a1, a2, a3, ax
  });

  // Round 9: another device moved a1 to the end while the editor was open (synced in before the
  // save), and the user added X right after a1 and Y at the end. Both runs follow the highest kept
  // key before them, a1's (the kept keys are out of order: [k4, -, k2, k3, -]), with nothing live
  // above it: both get keysBetween(k4, null, 1), the same key, so the two new photos tie and show in
  // id order, Y before X here, though the user put X first ("never tying", positionsBetween).
  it.fails(
    'setRefs gives two photos added in one save distinct keys in their order after a reorder made elsewhere',
    async () => {
      const posts = makeEdgeRepository('post_assets', schema.postAssets, 'postId');
      const seed = [
        { id: 'r1', assetId: 'a1' },
        { id: 'r2', assetId: 'a2' },
        { id: 'r3', assetId: 'a3' },
      ];
      await posts.createFromRefs(db, 'post-1', seed);
      await posts.move(db, 'post-1', 'a1', 'a3'); // another device's, synced in
      const x = { id: 'r9', assetId: 'ax' };
      const y = { id: 'r5', assetId: 'ay' };
      await posts.setRefs(db, 'post-1', [seed[0]!, x, seed[1]!, seed[2]!, y], seed);
      const rows = await db.select().from(schema.postAssets);
      const position = (id: string) => rows.find((r) => r.id === id)!.position;
      expect(position('r9')).not.toBe(position('r5')); // actual: the same key
      expect(position('r9') < position('r5')).toBe(true);
    },
  );

  // Round 9: another device put a photo at the front of the post (its editor's insert, or a drag:
  // keyBetween(null, k1)), synced in while this editor was open. The user, whose seed hasn't that
  // photo, adds one at the front: its run is keyed between "the front" and a1's kept key, which the
  // other device's key already sits between, and gets that very key. The two tie and show in id order,
  // though that live key was known at the save ("so it ties with none", positionsBetween).
  it.fails('setRefs keys a photo added at the front apart from a live photo another device put there', async () => {
    const posts = makeEdgeRepository('post_assets', schema.postAssets, 'postId');
    const seed = [
      { id: 'r1', assetId: 'a1' },
      { id: 'r2', assetId: 'a2' },
    ];
    await posts.createFromRefs(db, 'post-1', seed);
    await posts.setRefs(db, 'post-1', [{ id: 'rz', assetId: 'az' }, ...seed], seed); // the other device's, synced in
    await posts.setRefs(db, 'post-1', [{ id: 'rx', assetId: 'ax' }, ...seed], seed);
    const rows = await db.select().from(schema.postAssets);
    const position = (id: string) => rows.find((r) => r.id === id)!.position;
    expect(position('rx')).not.toBe(position('rz')); // actual: the same key
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
