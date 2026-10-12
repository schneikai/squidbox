/* eslint-disable @typescript-eslint/no-explicit-any -- generic over any collection's table */
import { eq, inArray } from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';

import { nextUpdatedAt } from './clock';
import type { SyncDb } from './db/types';
import { enqueueMutation } from './outbox';

// Generic repository for a syncable collection with NO local-only fields (albums, posts). Assets
// keep their own repository because syncError must be stripped from the wire payload. Every write
// is one transaction (row + coalesced outbox) with the monotonic clock.
export function makeRepository(collection: string, table: SQLiteTable) {
  const t = table as any;
  return {
    async create(db: SyncDb, record: Record<string, any>): Promise<Record<string, any>> {
      const row = { ...record, updatedAt: nextUpdatedAt(record.updatedAt) };
      await db.transaction(async (tx) => {
        await (tx as any).insert(table).values(row);
        await enqueueMutation(tx as SyncDb, collection, row as any);
      });
      return row;
    },
    async update(db: SyncDb, id: string, changes: Record<string, any>): Promise<void> {
      await db.transaction(async (tx) => {
        const prev = await (tx as any).select().from(table).where(eq(t.id, id)).get();
        if (!prev) return;
        const next = { ...prev, ...changes, updatedAt: nextUpdatedAt(prev.updatedAt) };
        await (tx as any).update(table).set(next).where(eq(t.id, id));
        await enqueueMutation(tx as SyncDb, collection, next);
      });
    },
    async remove(db: SyncDb, ids: string[]): Promise<void> {
      await db.transaction(async (tx) => {
        const rows = await (tx as any).select().from(table).where(inArray(t.id, ids));
        for (const prev of rows) {
          const ts = nextUpdatedAt(prev.updatedAt);
          const next = { ...prev, updatedAt: ts, deletedAt: ts };
          await (tx as any).update(table).set(next).where(eq(t.id, prev.id));
          await enqueueMutation(tx as SyncDb, collection, next);
        }
      });
    },
  };
}
