/* eslint-disable @typescript-eslint/no-explicit-any -- generic over any edge table */
import { keyBetween, initialKeys } from '@squidbox/shared';
import { and, eq, isNull } from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';

import { nextUpdatedAt, nextVersion, tombstone } from './clock';
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
  const byPosition = (a: any, b: any) => (a.position < b.position ? -1 : a.position > b.position ? 1 : 0);

  async function liveSorted(tx: SyncDb, parentId: string): Promise<any[]> {
    const rows = await tx
      .select()
      .from(table)
      .where(and(eq(parentCol, parentId), isNull(t.deletedAt)));
    return rows.sort(byPosition);
  }
  // Canonical edge per assetId (dedupe a rare double-add), keyed for reorder/existence checks.
  function canonicalByAsset(edges: any[]): Map<string, any> {
    const m = new Map<string, any>();
    for (const e of edges) if (!m.has(e.assetId)) m.set(e.assetId, e);
    return m;
  }
  function newEdge(id: string, parentId: string, assetId: string, position: string, now: number) {
    return {
      id,
      createdAt: now,
      updatedAt: nextUpdatedAt(undefined),
      deletedAt: null,
      [parentField]: parentId,
      assetId,
      position,
    };
  }
  const save = (tx: SyncDb, edges: any[]) => saveRecords(tx, collection, table, edges);

  return {
    /** Append assetIds not already present, each after the current last (fractional position). */
    async add(db: SyncDb, parentId: string, assetIds: string[], newId: () => string): Promise<void> {
      await db.transaction(async (tx) => {
        const live = await liveSorted(tx, parentId);
        const existing = new Set(live.map((e) => e.assetId));
        let last: string | null = live.length ? live[live.length - 1].position : null;
        const now = Date.now();
        const added = [];
        for (const assetId of assetIds) {
          if (existing.has(assetId)) continue;
          last = keyBetween(last, null);
          added.push(newEdge(newId(), parentId, assetId, last, now));
          existing.add(assetId);
        }
        await save(tx, added);
      });
    },

    /** Create edges for a fully-specified ordered ref list (post creation: ids come from the editor). */
    async createFromRefs(db: SyncDb, parentId: string, refs: { id: string; assetId: string }[]): Promise<void> {
      if (refs.length === 0) return;
      const keys = initialKeys(refs.length);
      const now = Date.now();
      const edges = refs.map((ref, i) => newEdge(ref.id, parentId, ref.assetId, keys[i]!, now));
      await db.transaction((tx) => save(tx, edges));
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
      const set = new Set(assetIds);
      await db.transaction(async (tx) => {
        const live = await liveSorted(tx, parentId);
        await save(tx, live.filter((e) => set.has(e.assetId)).map(tombstone));
      });
    },

    /** Reassign positions to match `orderedAssetIds`; only rewrites edges whose position changed. */
    async reorder(db: SyncDb, parentId: string, orderedAssetIds: string[]): Promise<void> {
      await db.transaction(async (tx) => {
        const canonical = canonicalByAsset(await liveSorted(tx, parentId));
        const keys = initialKeys(orderedAssetIds.length);
        const moved = [];
        for (const [i, assetId] of orderedAssetIds.entries()) {
          const e = canonical.get(assetId);
          if (e && e.position !== keys[i]) moved.push(nextVersion(e, { position: keys[i] }));
        }
        await save(tx, moved);
      });
    },

    /** Tombstone all live edges for a parent (its album/post was deleted). */
    async tombstoneParent(db: SyncDb, parentId: string): Promise<void> {
      await db.transaction(async (tx) => save(tx, (await liveSorted(tx, parentId)).map(tombstone)));
    },
  };
}
