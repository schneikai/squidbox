/* eslint-disable @typescript-eslint/no-explicit-any -- generic over any edge table */
import { keyBetween, initialKeys, keysBetween, movePositions } from '@squidbox/shared';
import { and, eq, gt, isNull, max, ne } from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';

import { nextVersion, tombstone } from './clock';
import type { SyncDb } from './db/types';
import { inJson } from './inJson';
import { readByIdMap } from './readByIds';
import { saveRecords } from './saveRecords';

// Repository for a junction/edge collection (album_assets, post_assets). add / remove / reorder
// are independent edge writes (row + coalesced outbox), so concurrent membership edits on two
// devices compose instead of clobbering. `position` is a fractional-index order key; a reorder
// only rewrites the edges whose position actually changed. Every write is one transaction. `newId`
// is injected (the app passes getNewItemId; tests pass a stub) to keep this module headless-testable.
export function makeEdgeRepository(collection: string, table: SQLiteTable, parentField: 'albumId' | 'postId') {
  const t = table as any;
  const parentCol = t[parentField];

  // The parent's live edges in canonical order, `(position, id)`: the id tie-break keeps every device
  // on the same order when two offline appends got the same key.
  async function liveSorted(tx: SyncDb, parentId: string): Promise<any[]> {
    return tx
      .select()
      .from(table)
      .where(and(eq(parentCol, parentId), isNull(t.deletedAt)))
      .orderBy(t.position, t.id);
  }
  // The parent's live edges to these assets, in canonical order.
  async function liveTo(tx: SyncDb, parentId: string, assetIds: string[]): Promise<any[]> {
    return tx
      .select()
      .from(table)
      .where(and(eq(parentCol, parentId), inJson(t.assetId, assetIds), isNull(t.deletedAt)))
      .orderBy(t.position, t.id);
  }
  // The canonical edge per assetId, the first of `edges` (in canonical order), and the duplicates a
  // concurrent add on two offline devices left behind, which a reorder or move tombstones: left at
  // their old key, one could become the earliest edge and show the asset at its old slot.
  function canonicalByAsset(edges: any[]): { canonical: Map<string, any>; duplicates: any[] } {
    const canonical = new Map<string, any>();
    const duplicates = [];
    for (const e of edges) {
      if (canonical.has(e.assetId)) duplicates.push(e);
      else canonical.set(e.assetId, e);
    }
    return { canonical, duplicates };
  }
  function newEdge(id: string, parentId: string, assetId: string, position: string, now: number) {
    return { id, createdAt: now, updatedAt: now, deletedAt: null, [parentField]: parentId, assetId, position };
  }
  const save = (tx: SyncDb, edges: any[], previous: any[]) => saveRecords(tx, collection, table, edges, { previous });
  const insert = (tx: SyncDb, edges: any[]) => saveRecords(tx, collection, table, edges, { isNew: true });
  const tombstoneAll = (tx: SyncDb, edges: any[]) => save(tx, edges.map(tombstone), edges);

  /**
   * Reassign positions to match `orderedAssetIds`, with the parent's other live edges (assets not
   * given, e.g. soft-deleted ones a grid doesn't show) after them in their current order. Only
   * rewrites edges whose position changed, and tombstones duplicate edges.
   */
  async function reorder(db: SyncDb, parentId: string, orderedAssetIds: string[]): Promise<void> {
    await db.transaction(async (tx) => {
      const live = await liveSorted(tx, parentId);
      const { canonical, duplicates } = canonicalByAsset(live);
      const given = new Set(orderedAssetIds);
      const order = [...given].filter((id) => canonical.has(id));
      for (const id of canonical.keys()) if (!given.has(id)) order.push(id);
      const keys = initialKeys(order.length);
      const changed = duplicates.map(tombstone);
      for (const [i, assetId] of order.entries()) {
        const e = canonical.get(assetId);
        if (e.position !== keys[i]) changed.push(nextVersion(e, { position: keys[i] }));
      }
      await save(tx, changed, live);
    });
  }

  /**
   * Move `assetId` right after `afterId` (`null`: to the front) with one new position between
   * `afterId`'s canonical edge and the next live edge as the database sees it, so the caller only
   * names the row it dropped after (movePositions). When edges after it share its key (two offline
   * appends), those are re-keyed after the moved one too. Duplicate edges of the moved asset are
   * tombstoned. An asset that left the parent meanwhile has nothing to move, nor one dropped after one.
   */
  async function move(db: SyncDb, parentId: string, assetId: string, afterId: string | null): Promise<void> {
    await db.transaction(async (tx) => {
      const { canonical, duplicates } = canonicalByAsset(await liveTo(tx, parentId, [assetId]));
      const moved = canonical.get(assetId);
      if (!moved) return;
      const after = afterId === null ? null : (await liveTo(tx, parentId, [afterId]))[0];
      if (afterId !== null && !after) return;
      // The edges movePositions needs: the one dropped after, those tied with it after it, and the next.
      const others = and(eq(parentCol, parentId), isNull(t.deletedAt), ne(t.assetId, assetId));
      const tied = after
        ? await tx
            .select()
            .from(table)
            .where(and(others, eq(t.position, after.position), gt(t.id, after.id)))
            .orderBy(t.id)
        : [];
      const [next] = await tx
        .select()
        .from(table)
        .where(after ? and(others, gt(t.position, after.position)) : others)
        .orderBy(t.position, t.id)
        .limit(1);
      const neighbors = [...(after ? [after] : []), ...tied, ...(next ? [next] : []), moved];
      const updates = movePositions(neighbors, moved.id, after?.id ?? null);
      const changed = neighbors.filter((e) => updates[e.id]).map((e) => nextVersion(e, updates[e.id]));
      await save(tx, [...changed, ...duplicates.map(tombstone)], [...neighbors, ...duplicates]);
    });
  }

  return {
    /** Append assetIds not already present, each after the current last (fractional position). */
    async add(db: SyncDb, parentId: string, assetIds: string[], newId: () => string): Promise<void> {
      await db.transaction(async (tx) => {
        const existing = new Set((await liveTo(tx, parentId, assetIds)).map((e) => e.assetId));
        const [{ last }] = await tx
          .select({ last: max(t.position) })
          .from(table)
          .where(and(eq(parentCol, parentId), isNull(t.deletedAt)));
        let position: string | null = last ?? null;
        const now = Date.now();
        const added = [];
        for (const assetId of assetIds) {
          if (existing.has(assetId)) continue;
          position = keyBetween(position, null);
          added.push(newEdge(newId(), parentId, assetId, position, now));
          existing.add(assetId);
        }
        await insert(tx, added);
      });
    },

    /** Create edges for a fully-specified ordered ref list (post creation: ids come from the editor). */
    async createFromRefs(db: SyncDb, parentId: string, refs: { id: string; assetId: string }[]): Promise<void> {
      if (refs.length === 0) return;
      const keys = initialKeys(refs.length);
      const now = Date.now();
      const edges = refs.map((ref, i) => newEdge(ref.id, parentId, ref.assetId, keys[i]!, now));
      await db.transaction((tx) => insert(tx, edges));
    },

    /**
     * Save an editor's ordered ref list (`refs`, {id, assetId}[], e.g. a post editor save) over the one
     * it was seeded with (`seed`), as edits of that seed (sync-design §7):
     * - a photo the user took out loses every live edge to it (an offline add on two devices makes two);
     * - a ref the user added is created, or restored as its edge's next version if it was removed;
     * - a seed ref whose edge is gone was removed elsewhere meanwhile, and stays out;
     * - the listed edges go in the list's order, with new keys only for those out of order, so the
     *   live edges the seed didn't have (another device's add, a photo hidden from the editor because
     *   its purge waits) keep their places, as a reorder keeps the edges it wasn't given.
     * Matches by edge id (existing refs keep their id; new ones carry a fresh id from the editor).
     */
    async setRefs(
      db: SyncDb,
      parentId: string,
      refs: { id: string; assetId: string }[],
      seed: { id: string; assetId: string }[],
    ): Promise<void> {
      await db.transaction(async (tx) => {
        const live = await liveSorted(tx, parentId);
        const liveById = new Map(live.map((e) => [e.id, e]));
        const listedIds = new Set(refs.map((r) => r.id));
        const listedAssets = new Set(refs.map((r) => r.assetId));
        const seedIds = new Set(seed.map((r) => r.id));
        const takenOutAssets = new Set(seed.map((r) => r.assetId).filter((assetId) => !listedAssets.has(assetId)));
        const takenOut = live.filter(
          (e) => takenOutAssets.has(e.assetId) || (seedIds.has(e.id) && !listedIds.has(e.id)),
        );
        const wanted = refs.filter((r) => liveById.has(r.id) || !seedIds.has(r.id));
        const removedById = await readByIdMap(
          tx,
          table,
          wanted.filter((r) => !liveById.has(r.id)).map((r) => r.id),
        );
        const keys = positionsInOrder(wanted.map((r) => liveById.get(r.id)?.position ?? null));
        const now = Date.now();
        const changed = takenOut.map(tombstone);
        for (const [i, ref] of wanted.entries()) {
          const existing = liveById.get(ref.id);
          const removed = removedById.get(ref.id);
          if (existing) {
            if (existing.position === keys[i] && existing.assetId === ref.assetId) continue;
            changed.push(nextVersion(existing, { assetId: ref.assetId, position: keys[i] }));
          } else if (removed) {
            changed.push(nextVersion(removed, { deletedAt: null, assetId: ref.assetId, position: keys[i] }));
          } else changed.push(newEdge(ref.id, parentId, ref.assetId, keys[i]!, now));
        }
        await save(tx, changed, [...live, ...removedById.values()]);
      });
    },

    /** Tombstone every live edge for (parentId, assetId ∈ set). */
    async remove(db: SyncDb, parentId: string, assetIds: string[]): Promise<void> {
      await db.transaction(async (tx) => tombstoneAll(tx, await liveTo(tx, parentId, assetIds)));
    },

    reorder,
    move,

    /** Tombstone all live edges for a parent (its album/post was deleted). */
    async tombstoneParent(db: SyncDb, parentId: string): Promise<void> {
      await db.transaction(async (tx) => tombstoneAll(tx, await liveSorted(tx, parentId)));
    },
  };
}

// Keys for a list in its order, from the keys its entries have (null for a new one): the longest run
// of keys already increasing stays, and the others get keys between their neighbours in that run.
function positionsInOrder(current: (string | null)[]): string[] {
  const kept = longestIncreasing(current);
  const keys: string[] = [];
  let prev: string | null = null;
  for (let i = 0; i < current.length;) {
    if (kept.has(i)) {
      prev = current[i]!;
      keys.push(prev);
      i++;
      continue;
    }
    let j = i;
    while (j < current.length && !kept.has(j)) j++;
    keys.push(...keysBetween(prev, j < current.length ? current[j]! : null, j - i));
    i = j;
  }
  return keys;
}

// The indices of a longest strictly increasing run of the non-null keys (patience sorting, n log n).
function longestIncreasing(keys: (string | null)[]): Set<number> {
  const tails: number[] = []; // index of the smallest tail of each run length
  const previous = new Array<number>(keys.length).fill(-1);
  for (const [i, key] of keys.entries()) {
    if (key === null) continue;
    let lo = 0;
    let hi = tails.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (keys[tails[mid]!]! < key) lo = mid + 1;
      else hi = mid;
    }
    previous[i] = lo > 0 ? tails[lo - 1]! : -1;
    tails[lo] = i;
  }
  const run = new Set<number>();
  for (let i = tails.length > 0 ? tails[tails.length - 1]! : -1; i !== -1; i = previous[i]!) run.add(i);
  return run;
}
