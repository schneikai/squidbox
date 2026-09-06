/* eslint-disable @typescript-eslint/no-explicit-any -- generic over any collection's table */
import { eq, inArray } from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';
import type { SyncDb } from './db/types';
import { enqueueMutation } from './outbox';
import { nextUpdatedAt } from './clock';

// Generic repository for a syncable collection with NO local-only fields (albums, posts). Assets
// keep their own repository because syncError must be stripped from the wire payload. All writes
// are one synchronous SQLite transaction (row + coalesced outbox) with the monotonic clock.
export function makeRepository(collection: string, table: SQLiteTable) {
  const t = table as any;
  return {
    create(db: SyncDb, record: Record<string, any>): Record<string, any> {
      const row = { ...record, updatedAt: nextUpdatedAt(record.updatedAt) };
      db.transaction((tx) => {
        (tx as any).insert(table).values(row).run();
        enqueueMutation(tx as SyncDb, collection, row as any);
      });
      return row;
    },
    update(db: SyncDb, id: string, changes: Record<string, any>): void {
      db.transaction((tx) => {
        const prev = (tx as any).select().from(table).where(eq(t.id, id)).get();
        if (!prev) return;
        const next = { ...prev, ...changes, updatedAt: nextUpdatedAt(prev.updatedAt) };
        (tx as any).update(table).set(next).where(eq(t.id, id)).run();
        enqueueMutation(tx as SyncDb, collection, next);
      });
    },
    remove(db: SyncDb, ids: string[]): void {
      db.transaction((tx) => {
        const rows = (tx as any).select().from(table).where(inArray(t.id, ids)).all();
        for (const prev of rows) {
          const ts = nextUpdatedAt(prev.updatedAt);
          const next = { ...prev, updatedAt: ts, deletedAt: ts };
          (tx as any).update(table).set(next).where(eq(t.id, prev.id)).run();
          enqueueMutation(tx as SyncDb, collection, next);
        }
      });
    },
  };
}
