/* eslint-disable @typescript-eslint/no-explicit-any -- generic over any membership table */
import { chunk } from '@squidbox/shared';
import { and, eq, isNull, or, type SQL } from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';

import { nextUpdatedAt, nextVersion, tombstone } from './clock';
import * as schema from './db/schema';
import type { SyncDb } from './db/types';
import { inJson } from './inJson';
import { saveRecords } from './saveRecords';

type Parent = Record<string, string>;

// How many parents addToEach reads the edges of in one statement.
const PARENTS_PER_READ = 200;

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
  const matches = (match: Parent): SQL => and(...Object.entries(match).map(([field, value]) => eq(t[field], value)))!;
  const isParent = (parent: Parent): SQL => and(...parentFields.map((field) => eq(t[field], parent[field])))!;
  const parentKey = (edge: Parent) => JSON.stringify(parentFields.map((field) => edge[field]));
  const read = (tx: SyncDb, where: SQL | undefined) => tx.select().from(table).where(where) as Promise<any[]>;
  const tombstoneAll = (tx: SyncDb, edges: any[]) =>
    saveRecords(tx, collection, table, edges.map(tombstone), { previous: edges });

  // Writes the parents' edges so the `added` children are in each and the `removed` ones out of it,
  // from `edges` (theirs of those children, tombstones included, through the parent index): a pair
  // with a live edge is kept, one whose edges are all tombstones gets its newest one restored, the
  // rest get a new edge.
  async function write(
    tx: SyncDb,
    parents: Parent[],
    edges: any[],
    { added, removed = [] }: { added: string[]; removed?: string[] },
    newId: () => string,
  ): Promise<void> {
    const adding = new Set(added);
    const leaving = new Set(removed);
    const live = new Set(edges.filter((e) => e.deletedAt === null).map((e) => `${parentKey(e)}:${e[childField]}`));
    const restoring = new Map<string, any>();
    for (const e of edges.filter((edge) => adding.has(edge[childField]))) {
      const pair = `${parentKey(e)}:${e[childField]}`;
      if (!live.has(pair) && (restoring.get(pair)?.updatedAt ?? -1) < e.updatedAt) restoring.set(pair, e);
    }
    const now = Date.now();
    const created = parents.flatMap((parent) =>
      [...adding]
        .filter((id) => !live.has(`${parentKey(parent)}:${id}`) && !restoring.has(`${parentKey(parent)}:${id}`))
        .map((id) => ({ id: newId(), createdAt: now, updatedAt: now, deletedAt: null, ...parent, [childField]: id })),
    );
    await tombstoneAll(
      tx,
      edges.filter((e) => e.deletedAt === null && leaving.has(e[childField])),
    );
    const restored = [...restoring.values()];
    await saveRecords(
      tx,
      collection,
      table,
      restored.map((e) => nextVersion(e, { deletedAt: null })),
      { previous: restored },
    );
    await saveRecords(tx, collection, table, created, { isNew: true });
  }

  /**
   * Puts these children in every one of the parents, in one transaction. The parents' edges are read
   * PARENTS_PER_READ parents at a time: an album's every photo is one `or` per photo, and SQLite
   * refuses an expression deeper than 1000.
   */
  async function addToEach(db: SyncDb, parents: Parent[], childIds: string[], newId: () => string): Promise<void> {
    if (childIds.length === 0 || parents.length === 0) return;
    await db.transaction(async (tx) => {
      const edges: any[] = [];
      for (const some of chunk(parents, PARENTS_PER_READ))
        edges.push(...(await read(tx, and(or(...some.map(isParent)), inJson(t[childField], childIds)))));
      await write(tx, parents, edges, { added: childIds }, newId);
    });
  }

  /** Takes these children out of every one of the parents, in one transaction (read as addToEach). */
  async function removeFromEach(db: SyncDb, parents: Parent[], childIds: string[]): Promise<void> {
    if (childIds.length === 0 || parents.length === 0) return;
    await db.transaction(async (tx) => {
      const edges: any[] = [];
      for (const some of chunk(parents, PARENTS_PER_READ))
        edges.push(
          ...(await read(tx, and(or(...some.map(isParent)), inJson(t[childField], childIds), isNull(t.deletedAt)))),
        );
      await tombstoneAll(tx, edges);
    });
  }

  return {
    addToEach,
    removeFromEach,

    /** Puts these children in the parent (one transaction, one read of its edges). */
    add: (db: SyncDb, parent: Parent, childIds: string[], newId: () => string) =>
      addToEach(db, [parent], childIds, newId),

    /** Tombstones every live edge of these children in the parent. */
    async remove(db: SyncDb, parent: Parent, childIds: string[]): Promise<void> {
      if (childIds.length === 0) return;
      await db.transaction(async (tx) =>
        tombstoneAll(tx, await read(tx, and(isParent(parent), inJson(t[childField], childIds), isNull(t.deletedAt)))),
      );
    },

    /**
     * Puts the `added` children in the parent and takes the `removed` ones out, from one read of
     * the parent's edges of those children, in one transaction. Only what the user changed is
     * written: a child another device added or removed meanwhile keeps that change.
     */
    async change(
      db: SyncDb,
      parent: Parent,
      { added, removed }: { added: string[]; removed: string[] },
      newId: () => string,
    ): Promise<void> {
      if (added.length === 0 && removed.length === 0) return;
      await db.transaction(async (tx) => {
        const edges = await read(tx, and(isParent(parent), inJson(t[childField], [...added, ...removed])));
        await write(tx, [parent], edges, { added, removed }, newId);
      });
    },

    /**
     * Tombstones every live edge that `match` names: a parent's (`{ listId }`, its list was deleted)
     * or a child's (`{ contactId }`, its contact was deleted). `deletedAt` stamps them all with the
     * deletion that took them (the contact's own), so `restoreWhere` can bring back exactly those.
     */
    async tombstoneWhere(db: SyncDb, match: Parent, deletedAt?: number): Promise<void> {
      await db.transaction(async (tx) => {
        const edges = await read(tx, and(matches(match), isNull(t.deletedAt)));
        if (deletedAt === undefined) return tombstoneAll(tx, edges);
        const stamped = edges.map((e) => ({ ...e, updatedAt: nextUpdatedAt(e.updatedAt, deletedAt), deletedAt }));
        await saveRecords(tx, collection, table, stamped, { previous: edges });
      });
    },

    /**
     * Brings back the edges that `match` names and the deletion stamped `deletedAt` took
     * (`tombstoneWhere`), and only those: one removed before or after it stays removed. `also`
     * narrows them further (a list's edges only while the list is live).
     */
    async restoreWhere(db: SyncDb, match: Parent, deletedAt: number, also?: SQL): Promise<void> {
      await db.transaction(async (tx) => {
        const edges = await read(tx, and(matches(match), eq(t.deletedAt, deletedAt), also));
        await saveRecords(
          tx,
          collection,
          table,
          edges.map((e) => nextVersion(e, { deletedAt: null })),
          { previous: edges },
        );
      });
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
