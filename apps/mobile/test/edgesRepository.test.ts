import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { makeEdgeRepository } from '../src/sync/edgesRepository';
import { orderedAssetsByAlbum } from '../src/sync/derive';
import * as schema from '../src/sync/db/schema';
import type { SyncDb } from '../src/sync/db/types';
import { makeTestDb } from './helpers/testDb';

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
    const rows = await db.select().from(schema.albumAssets);
    return orderedAssetsByAlbum(rows as any)[AL] ?? [];
  }
  async function outboxCount(): Promise<number> {
    const rows = await db.select().from(schema.outbox).where(eq(schema.outbox.collection, 'album_assets'));
    return rows.length;
  }

  it('add appends in order, skips duplicates, and enqueues one outbox row per edge', async () => {
    edges.add(db, AL, ['a', 'b', 'c'], newId);
    expect(await order()).toEqual(['a', 'b', 'c']);
    expect(await outboxCount()).toBe(3);

    edges.add(db, AL, ['b', 'd'], newId); // b already present → only d added
    expect(await order()).toEqual(['a', 'b', 'c', 'd']);
    expect(await outboxCount()).toBe(4);
  });

  it('reorder rewrites positions to match the given order', async () => {
    edges.add(db, AL, ['a', 'b', 'c'], newId);
    edges.reorder(db, AL, ['c', 'a', 'b']);
    expect(await order()).toEqual(['c', 'a', 'b']);
  });

  it('remove tombstones the edge (dropped from the ordered read)', async () => {
    edges.add(db, AL, ['a', 'b', 'c'], newId);
    edges.remove(db, AL, ['b']);
    expect(await order()).toEqual(['a', 'c']);
    // Re-adding b creates a fresh live edge again.
    edges.add(db, AL, ['b'], newId);
    expect(await order()).toEqual(['a', 'c', 'b']);
  });

  it('tombstoneParent tombstones every live edge for the parent (album/post deleted)', async () => {
    edges.add(db, AL, ['a', 'b', 'c'], newId);
    edges.add(db, 'album-2', ['x'], newId); // a different album is untouched
    edges.tombstoneParent(db, AL);
    expect(await order()).toEqual([]); // AL has no live edges
    const rows = await db.select().from(schema.albumAssets);
    expect(rows.filter((r) => r.albumId === AL).every((r) => r.deletedAt != null)).toBe(true);
    expect(orderedAssetsByAlbum(rows as any)['album-2']).toEqual(['x']); // other album intact
  });

  it('setRefs reconciles to exactly the target list (add + remove + reorder in one)', async () => {
    const posts = makeEdgeRepository('post_assets', schema.postAssets, 'postId');
    posts.createFromRefs(db, 'post-1', [
      { id: 'r1', assetId: 'a1' },
      { id: 'r2', assetId: 'a2' },
    ]);
    // Drop r1, keep r2, add r3 — and put r3 first.
    posts.setRefs(db, 'post-1', [
      { id: 'r3', assetId: 'a3' },
      { id: 'r2', assetId: 'a2' },
    ]);
    const rows = await db.select().from(schema.postAssets);
    const live = rows.filter((r) => r.deletedAt == null).sort((a, b) => (a.position < b.position ? -1 : 1));
    expect(live.map((r) => r.assetId)).toEqual(['a3', 'a2']);
    expect(rows.find((r) => r.id === 'r1')?.deletedAt).toBeTruthy(); // r1 tombstoned
  });
});
