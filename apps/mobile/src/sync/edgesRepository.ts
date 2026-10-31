/* eslint-disable @typescript-eslint/no-explicit-any -- generic over any edge table */
import { keyBetween, initialKeys, keysInOrder, longestIncreasing, movePositions } from '@squidbox/shared';
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
   * rewrites the edges out of that order (keysInOrder), and tombstones duplicate edges.
   */
  async function reorder(db: SyncDb, parentId: string, orderedAssetIds: string[]): Promise<void> {
    await db.transaction(async (tx) => {
      const live = await liveSorted(tx, parentId);
      const { canonical, duplicates } = canonicalByAsset(live);
      const given = new Set(orderedAssetIds);
      const order = [...given].filter((id) => canonical.has(id));
      for (const id of canonical.keys()) if (!given.has(id)) order.push(id);
      const keys = keysInOrder(order.map((assetId) => canonical.get(assetId).position));
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
     * - a ref is moved by the user when its order relative to the others differs from the seed's
     *   (outside a longest run in the seed's order). The final order is every other live edge (the
     *   unmoved refs, and those the seed didn't have: another device's add, a photo hidden from the
     *   editor because its purge waits) in its current order, with each moved or new ref right after
     *   the ref before it in the list (first when none), and those ending the list at the end (an
     *   append, as add() does); keysInOrder then re-keys as few edges as that order needs, so a
     *   reorder made elsewhere while the editor was open stays, and no keys tie;
     * - a moved photo's duplicate edges are tombstoned, as reorder() and move() do.
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
        const refById = new Map(refs.map((r) => [r.id, r]));
        const listedAssets = new Set(refs.map((r) => r.assetId));
        const seedIndex = new Map(seed.map((r, i) => [r.id, i]));
        const takenOutAssets = new Set(seed.map((r) => r.assetId).filter((assetId) => !listedAssets.has(assetId)));
        const takenOut = live.filter(
          (e) => takenOutAssets.has(e.assetId) || (seedIndex.has(e.id) && !refById.has(e.id)),
        );
        const wanted = refs.filter((r) => liveById.has(r.id) || !seedIndex.has(r.id));
        const unmoved = longestIncreasing(
          wanted.map((r) => (liveById.has(r.id) ? (seedIndex.get(r.id) ?? null) : null)),
        );
        const moved = wanted.filter((_, i) => !unmoved.has(i));
        const movedIds = new Set(moved.map((r) => r.id));
        const movedAssets = new Set(moved.filter((r) => liveById.has(r.id)).map((r) => r.assetId));
        const duplicates = live.filter((e) => movedAssets.has(e.assetId) && !refById.has(e.id));
        const out = new Set([...takenOut, ...duplicates].map((e) => e.id));

        const order = live.filter((e) => !out.has(e.id) && !movedIds.has(e.id)).map((e) => e.id);
        let trailing = wanted.length; // where the run of moved refs ending the list starts
        while (trailing > 0 && movedIds.has(wanted[trailing - 1]!.id)) trailing--;
        for (const [i, ref] of wanted.entries()) {
          if (!movedIds.has(ref.id)) continue;
          if (i >= trailing) order.push(ref.id);
          else order.splice(i === 0 ? 0 : order.indexOf(wanted[i - 1]!.id) + 1, 0, ref.id);
        }
        const keys = keysInOrder(order.map((id) => liveById.get(id)?.position ?? null));

        const removedById = await readByIdMap(
          tx,
          table,
          wanted.filter((r) => !liveById.has(r.id)).map((r) => r.id),
        );
        const now = Date.now();
        const changed = [...takenOut, ...duplicates].map(tombstone);
        for (const [i, id] of order.entries()) {
          const position = keys[i]!;
          const assetId = refById.get(id)?.assetId;
          const existing = liveById.get(id);
          const removed = removedById.get(id);
          if (existing) {
            if (existing.position === position && (assetId === undefined || existing.assetId === assetId)) continue;
            changed.push(nextVersion(existing, { assetId: assetId ?? existing.assetId, position }));
          } else if (removed) changed.push(nextVersion(removed, { deletedAt: null, assetId, position }));
          else changed.push(newEdge(id, parentId, assetId!, position, now));
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

    /** Tombstone all live edges of these parents (a deleted thread's posts) with one read. */
    async tombstoneParents(db: SyncDb, parentIds: string[]): Promise<void> {
      if (parentIds.length === 0) return;
      await db.transaction(async (tx) => {
        const live = await tx
          .select()
          .from(table)
          .where(and(inJson(parentCol, parentIds), isNull(t.deletedAt)));
        await tombstoneAll(tx, live);
      });
    },
  };
}
