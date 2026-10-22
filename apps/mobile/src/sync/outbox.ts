import { chunk, type FieldClocks } from '@squidbox/shared';
import { and, count, eq, isNotNull, isNull, max, min, sql, sum } from 'drizzle-orm';

import * as schema from './db/schema';
import type { SyncDb } from './db/types';
import { inJson } from './inJson';
import { localOnlyKeys } from './localOnlyKeys';
import { SQL_BATCH } from './sqlBatch';

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
  return and(eq(schema.outbox.collection, collection), inJson(schema.outbox.recordId, recordIds));
}

type EditParts = { fields?: true; payload?: true };
/** A pending edit's updatedAt, with the parts asked for: its changed fields, its payload. */
export type PendingEdit<P extends EditParts = EditParts> = Pick<schema.OutboxRow, 'updatedAt'> &
  (P['fields'] extends true ? Pick<schema.OutboxRow, 'fields'> : unknown) &
  (P['payload'] extends true ? Pick<schema.OutboxRow, 'payload'> : unknown);

/**
 * The pending edits of these records, by record id: their updatedAt, and their changed fields and
 * payload when asked (the payload is the big one). Records without one are left out.
 */
export async function pendingEdits<P extends EditParts = Record<never, never>>(
  db: SyncDb,
  collection: string,
  recordIds: string[],
  parts?: P,
): Promise<Map<string, PendingEdit<P>>> {
  if (recordIds.length === 0) return new Map();
  const rows = await db
    .select({
      recordId: schema.outbox.recordId,
      updatedAt: schema.outbox.updatedAt,
      ...(parts?.fields && { fields: schema.outbox.fields }),
      ...(parts?.payload && { payload: schema.outbox.payload }),
    })
    .from(schema.outbox)
    .where(recordsIn(collection, recordIds));
  return new Map(rows.map(({ recordId, ...edit }) => [recordId, edit as PendingEdit<P>]));
}

export async function clearOutboxRows(db: SyncDb, collection: string, recordIds: string[]): Promise<void> {
  await db.delete(schema.outbox).where(recordsIn(collection, recordIds));
}

/** Records why the server rejected these records' pending payloads; a failed row waits (§6). */
export async function setOutboxError(
  db: SyncDb,
  collection: string,
  recordIds: string[],
  error: string,
): Promise<void> {
  await db.update(schema.outbox).set({ error }).where(recordsIn(collection, recordIds));
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

/** The newest outbox row's id, 0 when the outbox is empty. */
export async function newestOutboxId(db: SyncDb): Promise<number> {
  const [row] = await db.select({ id: max(schema.outbox.id) }).from(schema.outbox);
  return row?.id ?? 0;
}

/** The oldest outbox row's id, null when the outbox is empty (pushedThrough). */
export async function oldestOutboxId(db: SyncDb): Promise<number | null> {
  const [row] = await db.select({ id: min(schema.outbox.id) }).from(schema.outbox);
  return row?.id ?? null;
}

/**
 * Whether no outbox row up to `id` is left, given the oldest row's id: the rows of one record
 * coalesce in place and keep their id, so what was written by the time `id` was the newest has pushed.
 */
export const pushedThrough = (oldest: number | null, id: number) => oldest === null || oldest > id;

/**
 * The outbox's state as a string that changes with every write enqueued: a new row, or a record's
 * next updatedAt (which only grows) on its row.
 */
export async function outboxVersion(db: SyncDb): Promise<string> {
  const [row] = await db
    .select({ rows: count(), newest: max(schema.outbox.id), clocks: sum(schema.outbox.updatedAt) })
    .from(schema.outbox);
  return `${row?.rows ?? 0}:${row?.newest ?? 0}:${row?.clocks ?? 0}`;
}
