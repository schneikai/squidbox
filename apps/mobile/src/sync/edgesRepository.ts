/* eslint-disable @typescript-eslint/no-explicit-any -- generic over any edge table */
import { keyBetween, initialKeys } from '@squidbox/shared';
import { and, eq, isNull, max, ne, sql } from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';

import { inJson } from './assetSql';
import { nextVersion, tombstone } from './clock';
import type { SyncDb } from './db/types';
import { readByIds } from './readByIds';
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
  const save = (tx: SyncDb, edges: any[], options?: { isNew: boolean }) =>
    saveRecords(tx, collection, table, edges, options);

  /**
   * Reassign positions to match `orderedAssetIds`, with the parent's other live edges (assets not
   * given, e.g. soft-deleted ones a grid doesn't show) after them in their current order. Only
   * rewrites edges whose position changed, and tombstones duplicate edges.
   */
  async function reorder(db: SyncDb, parentId: string, orderedAssetIds: string[]): Promise<void> {
    await db.transaction(async (tx) => {
      const { canonical, duplicates } = canonicalByAsset(await liveSorted(tx, parentId));
      const given = new Set(orderedAssetIds);
      const order = [...given].filter((id) => canonical.has(id));
      for (const id of canonical.keys()) if (!given.has(id)) order.push(id);
      const keys = initialKeys(order.length);
      const changed = duplicates.map(tombstone);
      for (const [i, assetId] of order.entries()) {
        const e = canonical.get(assetId);
        if (e.position !== keys[i]) changed.push(nextVersion(e, { position: keys[i] }));
      }
      await save(tx, changed);
    });
  }

  /**
   * Move `assetId` right after `afterId` (`null`: to the front) with one new position between
   * `afterId`'s canonical edge and the next live edge as the database sees it, so the caller only
   * names the row it dropped after. Duplicate edges of the moved asset are tombstoned. When the two
   * neighbor keys are equal (two offline appends) no key fits between: the whole order is rewritten
   * instead. An asset that left the parent meanwhile has nothing to move, nor one dropped after one.
   */
  async function move(db: SyncDb, parentId: string, assetId: string, afterId: string | null): Promise<void> {
    await db.transaction(async (tx) => {
      const { canonical, duplicates } = canonicalByAsset(await liveTo(tx, parentId, [assetId]));
      const moved = canonical.get(assetId);
      if (!moved) return;
      const after = afterId === null ? null : (await liveTo(tx, parentId, [afterId]))[0];
      if (afterId !== null && !after) return;
      const others = and(eq(parentCol, parentId), isNull(t.deletedAt), ne(t.assetId, assetId));
      const [next] = await tx
        .select()
        .from(table)
        .where(after ? and(others, sql`(${t.position}, ${t.id}) > (${after.position}, ${after.id})`) : others)
        .orderBy(t.position, t.id)
        .limit(1);
      const lower = after?.position ?? null;
      const upper = next?.position ?? null;
      if (lower !== null && lower === upper) {
        const order = (await liveSorted(tx, parentId)).map((e) => e.assetId).filter((id) => id !== assetId);
        order.splice(afterId === null ? 0 : order.indexOf(afterId) + 1, 0, assetId);
        return reorder(tx, parentId, order);
      }
      await save(tx, [nextVersion(moved, { position: keyBetween(lower, upper) }), ...duplicates.map(tombstone)]);
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
        await save(tx, added, { isNew: true });
      });
    },

    /** Create edges for a fully-specified ordered ref list (post creation: ids come from the editor). */
    async createFromRefs(db: SyncDb, parentId: string, refs: { id: string; assetId: string }[]): Promise<void> {
      if (refs.length === 0) return;
      const keys = initialKeys(refs.length);
      const now = Date.now();
      const edges = refs.map((ref, i) => newEdge(ref.id, parentId, ref.assetId, keys[i]!, now));
      await db.transaction((tx) => save(tx, edges, { isNew: true }));
    },

    /**
     * Reconcile a parent's edges to exactly `refs` (an ordered {id, assetId}[], e.g. a post editor
     * save): tombstone edges no longer present, upsert the rest at their new positions. Matches by
     * edge id (existing refs keep their id; new ones carry a fresh id from the editor).
     */
    async setRefs(db: SyncDb, parentId: string, refs: { id: string; assetId: string }[]): Promise<void> {
      await db.transaction(async (tx) => {
        const live = await liveSorted(tx, parentId);
        const liveById = new Map(live.map((e) => [e.id, e]));
        const targetIds = new Set(refs.map((r) => r.id));
        const keys = initialKeys(refs.length);
        const now = Date.now();
        // A ref can name an edge that was removed meanwhile (e.g. on another device): it is restored as
        // that edge's next version, so the clock still moves forward.
        const removedIds = refs.map((r) => r.id).filter((id) => !liveById.has(id));
        const removedById = new Map((await readByIds(tx, table, removedIds)).map((e) => [e.id, e]));
        const changed = live.filter((e) => !targetIds.has(e.id)).map(tombstone);
        for (const [i, ref] of refs.entries()) {
          const existing = liveById.get(ref.id);
          const removed = removedById.get(ref.id);
          if (existing) {
            if (existing.position === keys[i] && existing.assetId === ref.assetId) continue;
            changed.push(nextVersion(existing, { assetId: ref.assetId, position: keys[i] }));
          } else if (removed) {
            changed.push(nextVersion(removed, { deletedAt: null, assetId: ref.assetId, position: keys[i] }));
          } else changed.push(newEdge(ref.id, parentId, ref.assetId, keys[i]!, now));
        }
        await save(tx, changed);
      });
    },

    /** Tombstone every live edge for (parentId, assetId ∈ set). */
    async remove(db: SyncDb, parentId: string, assetIds: string[]): Promise<void> {
      await db.transaction(async (tx) => save(tx, (await liveTo(tx, parentId, assetIds)).map(tombstone)));
    },

    reorder,
    move,

    /** Tombstone all live edges for a parent (its album/post was deleted). */
    async tombstoneParent(db: SyncDb, parentId: string): Promise<void> {
      await db.transaction(async (tx) => save(tx, (await liveSorted(tx, parentId)).map(tombstone)));
    },
  };
}
