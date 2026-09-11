/* eslint-disable @typescript-eslint/no-explicit-any -- generic over any edge table */
import { and, eq, isNull } from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';
import { keyBetween, initialKeys } from '@squidbox/shared';
import type { SyncDb } from './db/types';
import { enqueueMutation } from './outbox';
import { nextUpdatedAt } from './clock';

// Repository for a junction/edge collection (album_assets, post_assets). add / remove / reorder
// are independent edge writes (row + coalesced outbox), so concurrent membership edits on two
// devices compose instead of clobbering. `position` is a fractional-index order key; a reorder
// only rewrites the edges whose position actually changed. All writes are one synchronous SQLite
// transaction. `newId` is injected (the app passes getNewItemId; tests pass a stub) to keep this
// module headless-testable.
export function makeEdgeRepository(collection: string, table: SQLiteTable, parentField: 'albumId' | 'postId') {
  const t = table as any;
  const parentCol = t[parentField];
  const byPosition = (a: any, b: any) => (a.position < b.position ? -1 : a.position > b.position ? 1 : 0);

  function liveSorted(tx: any, parentId: string): any[] {
    return tx.select().from(table).where(and(eq(parentCol, parentId), isNull(t.deletedAt))).all().sort(byPosition);
  }
  // Canonical edge per assetId (dedupe a rare double-add), keyed for reorder/existence checks.
  function canonicalByAsset(edges: any[]): Map<string, any> {
    const m = new Map<string, any>();
    for (const e of edges) if (!m.has(e.assetId)) m.set(e.assetId, e);
    return m;
  }

  return {
    /** Append assetIds not already present, each after the current last (fractional position). */
    add(db: SyncDb, parentId: string, assetIds: string[], newId: () => string): void {
      db.transaction((tx) => {
        const live = liveSorted(tx as any, parentId);
        const existing = new Set(live.map((e) => e.assetId));
        let last: string | null = live.length ? live[live.length - 1].position : null;
        const now = Date.now();
        for (const assetId of assetIds) {
          if (existing.has(assetId)) continue;
          last = keyBetween(last, null);
          const row = {
            id: newId(),
            createdAt: now,
            updatedAt: nextUpdatedAt(undefined),
            deletedAt: null,
            [parentField]: parentId,
            assetId,
            position: last,
          };
          (tx as any).insert(table).values(row).run();
          enqueueMutation(tx as SyncDb, collection, row as any);
          existing.add(assetId);
        }
      });
    },

    /** Create edges for a fully-specified ordered ref list (post creation: ids come from the editor). */
    createFromRefs(db: SyncDb, parentId: string, refs: { id: string; assetId: string }[]): void {
      if (refs.length === 0) return;
      db.transaction((tx) => {
        const keys = initialKeys(refs.length);
        const now = Date.now();
        refs.forEach((ref, i) => {
          const row = {
            id: ref.id,
            createdAt: now,
            updatedAt: nextUpdatedAt(undefined),
            deletedAt: null,
            [parentField]: parentId,
            assetId: ref.assetId,
            position: keys[i],
          };
          (tx as any).insert(table).values(row).run();
          enqueueMutation(tx as SyncDb, collection, row as any);
        });
      });
    },

    /**
     * Reconcile a parent's edges to exactly `refs` (an ordered {id, assetId}[], e.g. a post editor
     * save): tombstone edges no longer present, upsert the rest at their new positions. Matches by
     * edge id (existing refs keep their id; new ones carry a fresh id from the editor).
     */
    setRefs(db: SyncDb, parentId: string, refs: { id: string; assetId: string }[]): void {
      db.transaction((tx) => {
        const live = liveSorted(tx as any, parentId);
        const liveById = new Map(live.map((e) => [e.id, e]));
        const targetIds = new Set(refs.map((r) => r.id));
        const keys = initialKeys(refs.length);
        const now = Date.now();
        for (const e of live) {
          if (targetIds.has(e.id)) continue;
          const ts = nextUpdatedAt(e.updatedAt);
          const next = { ...e, updatedAt: ts, deletedAt: ts };
          (tx as any).update(table).set(next).where(eq(t.id, e.id)).run();
          enqueueMutation(tx as SyncDb, collection, next);
        }
        refs.forEach((ref, i) => {
          const existing = liveById.get(ref.id);
          if (existing) {
            if (existing.position === keys[i] && existing.assetId === ref.assetId) return;
            const ts = nextUpdatedAt(existing.updatedAt);
            const next = { ...existing, assetId: ref.assetId, position: keys[i], updatedAt: ts };
            (tx as any).update(table).set(next).where(eq(t.id, ref.id)).run();
            enqueueMutation(tx as SyncDb, collection, next);
          } else {
            const row = {
              id: ref.id,
              createdAt: now,
              updatedAt: nextUpdatedAt(undefined),
              deletedAt: null,
              [parentField]: parentId,
              assetId: ref.assetId,
              position: keys[i],
            };
            (tx as any).insert(table).values(row).run();
            enqueueMutation(tx as SyncDb, collection, row as any);
          }
        });
      });
    },

    /** Tombstone every live edge for (parentId, assetId ∈ set). */
    remove(db: SyncDb, parentId: string, assetIds: string[]): void {
      const set = new Set(assetIds);
      db.transaction((tx) => {
        for (const e of liveSorted(tx as any, parentId)) {
          if (!set.has(e.assetId)) continue;
          const ts = nextUpdatedAt(e.updatedAt);
          const next = { ...e, updatedAt: ts, deletedAt: ts };
          (tx as any).update(table).set(next).where(eq(t.id, e.id)).run();
          enqueueMutation(tx as SyncDb, collection, next);
        }
      });
    },

    /** Reassign positions to match `orderedAssetIds`; only rewrites edges whose position changed. */
    reorder(db: SyncDb, parentId: string, orderedAssetIds: string[]): void {
      db.transaction((tx) => {
        const canonical = canonicalByAsset(liveSorted(tx as any, parentId));
        const keys = initialKeys(orderedAssetIds.length);
        orderedAssetIds.forEach((assetId, i) => {
          const e = canonical.get(assetId);
          if (!e || e.position === keys[i]) return;
          const ts = nextUpdatedAt(e.updatedAt);
          const next = { ...e, position: keys[i], updatedAt: ts };
          (tx as any).update(table).set(next).where(eq(t.id, e.id)).run();
          enqueueMutation(tx as SyncDb, collection, next);
        });
      });
    },

    /** Tombstone all live edges for a parent (its album/post was deleted). */
    tombstoneParent(db: SyncDb, parentId: string): void {
      db.transaction((tx) => {
        for (const e of liveSorted(tx as any, parentId)) {
          const ts = nextUpdatedAt(e.updatedAt);
          const next = { ...e, updatedAt: ts, deletedAt: ts };
          (tx as any).update(table).set(next).where(eq(t.id, e.id)).run();
          enqueueMutation(tx as SyncDb, collection, next);
        }
      });
    },
  };
}
