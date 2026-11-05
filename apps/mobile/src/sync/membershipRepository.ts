/* eslint-disable @typescript-eslint/no-explicit-any -- generic over any membership table */
import { and, eq, isNull, type SQL } from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';

import { nextVersion, tombstone } from './clock';
import * as schema from './db/schema';
import type { SyncDb } from './db/types';
import { inJson } from './inJson';
import { saveRecords } from './saveRecords';

type Parent = Record<string, string>;

/**
 * Repository for an unordered membership edge collection: one record per (parent, child) pair, the
 * child a contact (contact_list_members: a list's contacts; contact_links: the contacts on a photo,
 * album or post). `parent` names the columns that identify the parent (`{ listId }`, or
 * `{ targetType, targetId }`). Adding and removing are edge writes that sync, so two devices'
 * edits compose; removal is a tombstone, and adding again restores the pair's edge. Every write is
 * one transaction. `newId` is injected (the app passes getNewItemId) to keep this headless-testable.
 */
export function makeMembershipRepository(
  collection: string,
  table: SQLiteTable,
  { parent: parentFields, child: childField }: { parent: string[]; child: string },
) {
  const t = table as any;
  const isParent = (parent: Parent): SQL => and(...parentFields.map((field) => eq(t[field], parent[field])))!;
  const read = (tx: SyncDb, where: SQL | undefined) => tx.select().from(table).where(where) as Promise<any[]>;
  const tombstoneAll = (tx: SyncDb, edges: any[]) =>
    saveRecords(tx, collection, table, edges.map(tombstone), { previous: edges });

  /**
   * Puts these children in the parent: a pair with a live edge is skipped, one whose edges are all
   * tombstones gets its newest one restored, the rest get a new edge.
   */
  async function add(db: SyncDb, parent: Parent, childIds: string[], newId: () => string): Promise<void> {
    if (childIds.length === 0) return;
    await db.transaction(async (tx) => {
      const edges = await read(tx, and(isParent(parent), inJson(t[childField], childIds)));
      const live = new Set(edges.filter((e) => e.deletedAt === null).map((e) => e[childField]));
      const removed = new Map<string, any>();
      for (const e of edges)
        if (!live.has(e[childField]) && (removed.get(e[childField])?.updatedAt ?? -1) < e.updatedAt)
          removed.set(e[childField], e);
      const now = Date.now();
      const restored = [...removed.values()].map((e) => nextVersion(e, { deletedAt: null }));
      const created = [...new Set(childIds)]
        .filter((id) => !live.has(id) && !removed.has(id))
        .map((id) => ({ id: newId(), createdAt: now, updatedAt: now, deletedAt: null, ...parent, [childField]: id }));
      await saveRecords(tx, collection, table, restored, { previous: [...removed.values()] });
      await saveRecords(tx, collection, table, created, { isNew: true });
    });
  }

  /** Tombstones every live edge of these children in the parent. */
  async function remove(db: SyncDb, parent: Parent, childIds: string[]): Promise<void> {
    if (childIds.length === 0) return;
    await db.transaction(async (tx) =>
      tombstoneAll(tx, await read(tx, and(isParent(parent), inJson(t[childField], childIds), isNull(t.deletedAt)))),
    );
  }

  return {
    add,
    remove,

    /** Makes exactly these children the parent's: the others leave it (add and remove, in one transaction). */
    async set(db: SyncDb, parent: Parent, childIds: string[], newId: () => string): Promise<void> {
      await db.transaction(async (tx) => {
        const live = new Set(
          (await read(tx, and(isParent(parent), isNull(t.deletedAt)))).map((e) => e[childField] as string),
        );
        const wanted = new Set(childIds);
        await remove(
          tx,
          parent,
          [...live].filter((id) => !wanted.has(id)),
        );
        await add(
          tx,
          parent,
          [...wanted].filter((id) => !live.has(id)),
          newId,
        );
      });
    },

    /** Tombstones every live edge of the parent (its list was deleted). */
    async tombstoneParent(db: SyncDb, parent: Parent): Promise<void> {
      await db.transaction(async (tx) => tombstoneAll(tx, await read(tx, and(isParent(parent), isNull(t.deletedAt)))));
    },

    /** Tombstones every live edge of the child (its contact was deleted). */
    async tombstoneChild(db: SyncDb, childId: string): Promise<void> {
      await db.transaction(async (tx) =>
        tombstoneAll(tx, await read(tx, and(eq(t[childField], childId), isNull(t.deletedAt)))),
      );
    },
  };
}

export const contactListMembers = makeMembershipRepository('contact_list_members', schema.contactListMembers, {
  parent: ['listId'],
  child: 'contactId',
});

export const contactLinks = makeMembershipRepository('contact_links', schema.contactLinks, {
  parent: ['targetType', 'targetId'],
  child: 'contactId',
});
