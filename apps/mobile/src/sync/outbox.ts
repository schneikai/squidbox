import type { FieldClocks } from '@squidbox/shared';
import { and, count, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm';

import { chunk, SQL_BATCH } from './chunk';
import * as schema from './db/schema';
import type { SyncDb } from './db/types';
import { inJson } from './inJson';
import { localOnlyKeys } from './localOnlyKeys';

// Enqueue whole-record mutations with their changed fields, coalesced to one row per (collection,
// recordId): the latest payload wins and each field keeps its own last clock (sync-design §6). `op`
// is 'delete' for a tombstone, else 'upsert'. The payload leaves out local-only fields; a new payload
// clears the error of the one it replaces. Called inside the transaction that writes the records.
export async function enqueueMutations(
  tx: SyncDb,
  collection: string,
  records: { id: string; updatedAt: number; deletedAt?: number | null }[],
  fieldsById: Map<string, FieldClocks>,
): Promise<void> {
  const localOnly = localOnlyKeys(collection);
  for (const batch of chunk(records, SQL_BATCH)) {
    await tx
      .insert(schema.outbox)
      .values(
        batch.map((record) => ({
          collection,
          recordId: record.id,
          op: record.deletedAt != null ? ('delete' as const) : ('upsert' as const),
          payload: withoutKeys(record, localOnly),
          fields: fieldsById.get(record.id)!,
          updatedAt: record.updatedAt,
        })),
      )
      .onConflictDoUpdate({
        target: [schema.outbox.collection, schema.outbox.recordId],
        set: {
          op: sql`excluded."op"`,
          payload: sql`excluded."payload"`,
          fields: sql`json_patch(${schema.outbox.fields}, excluded."fields")`,
          updatedAt: sql`excluded."updated_at"`,
          error: null,
        },
      });
  }
}

function withoutKeys(record: object, keys: Set<string>): Record<string, unknown> {
  const copy: Record<string, unknown> = { ...record };
  for (const key of keys) delete copy[key];
  return copy;
}

function recordsIn(collection: string, recordIds: string[]) {
  return and(eq(schema.outbox.collection, collection), inArray(schema.outbox.recordId, recordIds));
}

/** The fields the pending edits of these records changed, by record id; records without a pending row are left out. */
export async function pendingFields(
  db: SyncDb,
  collection: string,
  recordIds: string[],
): Promise<Map<string, FieldClocks>> {
  const rows = await db
    .select({ recordId: schema.outbox.recordId, fields: schema.outbox.fields })
    .from(schema.outbox)
    .where(and(eq(schema.outbox.collection, collection), inJson(schema.outbox.recordId, recordIds)));
  return new Map(rows.map((r) => [r.recordId, r.fields]));
}

/** The outbox rows' updatedAt of these records, by record id; records without a pending row are left out. */
export async function outboxUpdatedAts(
  db: SyncDb,
  collection: string,
  recordIds: string[],
): Promise<Map<string, number>> {
  const updatedAts = new Map<string, number>();
  for (const batch of chunk(recordIds, SQL_BATCH)) {
    const rows = await db
      .select({ recordId: schema.outbox.recordId, updatedAt: schema.outbox.updatedAt })
      .from(schema.outbox)
      .where(recordsIn(collection, batch));
    for (const row of rows) updatedAts.set(row.recordId, row.updatedAt);
  }
  return updatedAts;
}

export async function clearOutboxRows(db: SyncDb, collection: string, recordIds: string[]): Promise<void> {
  for (const batch of chunk(recordIds, SQL_BATCH)) {
    await db.delete(schema.outbox).where(recordsIn(collection, batch));
  }
}

/** Records why the server rejected these records' pending payloads; a failed row waits (§6). */
export async function setOutboxError(
  db: SyncDb,
  collection: string,
  recordIds: string[],
  error: string,
): Promise<void> {
  for (const batch of chunk(recordIds, SQL_BATCH)) {
    await db.update(schema.outbox).set({ error }).where(recordsIn(collection, batch));
  }
}

// The push sends only the pushable rows; a failed one waits (§6).
export const failedOutboxRows = isNotNull(schema.outbox.error);
export const pushableOutboxRows = isNull(schema.outbox.error);

/** Clears the reason of every failed push, so each is pushed again (§6). */
export async function retryFailures(db: SyncDb): Promise<void> {
  await db.update(schema.outbox).set({ error: null }).where(failedOutboxRows);
}

/** The outbox rows, failed ones included, and the failed ones: through the indexes, no payload is read. */
export async function countOutbox(db: SyncDb): Promise<{ pending: number; failed: number }> {
  const [row] = await db
    .select({ pending: count(), failed: db.$count(schema.outbox, failedOutboxRows) })
    .from(schema.outbox);
  return { pending: row?.pending ?? 0, failed: row?.failed ?? 0 };
}
