import { collectionsByName } from '@squidbox/shared';
import { and, eq, sql } from 'drizzle-orm';

import * as schema from './db/schema';
import type { SyncDb } from './db/types';
import { chunk } from './pushPlan';

const BATCH = 500;

// Enqueue whole-record mutations, coalesced to one row per (collection, recordId): the latest
// payload wins (sync-design §6). `op` is 'delete' for a tombstone, else 'upsert'. The payload leaves
// out the collection's local-only fields. Called inside the transaction that writes the records.
export async function enqueueMutations(
  tx: SyncDb,
  collection: string,
  records: { id: string; updatedAt: number; deletedAt?: number | null }[],
): Promise<void> {
  const localOnly = Object.keys(collectionsByName[collection]?.localOnly ?? {});
  for (const batch of chunk(records, BATCH)) {
    await tx
      .insert(schema.outbox)
      .values(
        batch.map((record) => ({
          collection,
          recordId: record.id,
          op: record.deletedAt != null ? ('delete' as const) : ('upsert' as const),
          payload: withoutKeys(record, localOnly),
          updatedAt: record.updatedAt,
        })),
      )
      .onConflictDoUpdate({
        target: [schema.outbox.collection, schema.outbox.recordId],
        set: { op: sql`excluded."op"`, payload: sql`excluded."payload"`, updatedAt: sql`excluded."updated_at"` },
      });
  }
}

function withoutKeys(record: object, keys: string[]): Record<string, unknown> {
  const copy: Record<string, unknown> = { ...record };
  for (const key of keys) delete copy[key];
  return copy;
}

export async function pendingRecordIds(db: SyncDb, collection: string): Promise<Set<string>> {
  const rows = await db
    .select({ recordId: schema.outbox.recordId })
    .from(schema.outbox)
    .where(eq(schema.outbox.collection, collection));
  return new Set(rows.map((r) => r.recordId));
}

/** Current outbox row's updatedAt for a record, or null if none pending. */
export async function getOutboxUpdatedAt(db: SyncDb, collection: string, recordId: string): Promise<number | null> {
  const [row] = await db
    .select({ updatedAt: schema.outbox.updatedAt })
    .from(schema.outbox)
    .where(and(eq(schema.outbox.collection, collection), eq(schema.outbox.recordId, recordId)));
  return row?.updatedAt ?? null;
}

export async function clearOutboxRow(db: SyncDb, collection: string, recordId: string): Promise<void> {
  await db
    .delete(schema.outbox)
    .where(and(eq(schema.outbox.collection, collection), eq(schema.outbox.recordId, recordId)));
}
