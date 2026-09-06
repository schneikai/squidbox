import { and, eq, inArray, isNull } from 'drizzle-orm';
import type { AssetRecord } from '@squidbox/shared';
import { getDb, schema } from './db/client';
import type { AssetRow } from './db/schema';
import { enqueueMutation } from './outbox';
import { requestSync } from './worker';

const COLLECTION = 'assets';

// Per-record monotonic clock (sync-design §6): never let two writes share a millisecond, and
// never go backwards, so strict-`>` LWW on the server can't silently drop an edit.
function nextUpdatedAt(prev?: number): number {
  const t = Date.now();
  return prev != null && t <= prev ? prev + 1 : t;
}

function toRecord(row: AssetRow): AssetRecord {
  const { syncError: _syncError, ...record } = row;
  return record as unknown as AssetRecord;
}

/** All live (non-tombstoned) assets, id-keyed map — matches the shape screens consume. */
export async function loadAssetsMap(): Promise<Record<string, AssetRecord>> {
  const rows = await getDb().select().from(schema.assets).where(isNull(schema.assets.deletedAt));
  const map: Record<string, AssetRecord> = {};
  for (const row of rows) map[row.id] = toRecord(row);
  return map;
}

/** Create a new asset (full synced record). Writes the row + outbox in one transaction. */
export async function createAsset(record: AssetRecord): Promise<AssetRecord> {
  const row = { ...record, updatedAt: nextUpdatedAt(), syncError: null };
  await getDb().transaction(async (tx) => {
    await tx.insert(schema.assets).values(row);
    await enqueueMutation(tx, COLLECTION, row);
  });
  requestSync();
  return toRecord(row as AssetRow);
}

/** Patch synced fields of one asset. Reads prev for the monotonic clock. */
export async function updateAsset(id: string, changes: Partial<AssetRecord>): Promise<void> {
  await getDb().transaction(async (tx) => {
    const [prev] = await tx.select().from(schema.assets).where(eq(schema.assets.id, id));
    if (!prev) return;
    const next = { ...prev, ...changes, updatedAt: nextUpdatedAt(prev.updatedAt) };
    await tx.update(schema.assets).set(next).where(eq(schema.assets.id, id));
    const { syncError: _s, ...record } = next;
    await enqueueMutation(tx, COLLECTION, record);
  });
  requestSync();
}

export async function toggleFavorite(id: string): Promise<void> {
  const [row] = await getDb().select().from(schema.assets).where(eq(schema.assets.id, id));
  if (row) await updateAsset(id, { isFavorite: !row.isFavorite });
}

/** Soft-delete (tombstone): set deletedAt. Binary/thumbnail cleanup is handled by the caller. */
export async function deleteAssets(ids: string[]): Promise<void> {
  await getDb().transaction(async (tx) => {
    const rows = await tx.select().from(schema.assets).where(inArray(schema.assets.id, ids));
    for (const prev of rows) {
      const ts = nextUpdatedAt(prev.updatedAt);
      const next = { ...prev, updatedAt: ts, deletedAt: ts };
      await tx.update(schema.assets).set(next).where(eq(schema.assets.id, prev.id));
      const { syncError: _s, ...record } = next;
      await enqueueMutation(tx, COLLECTION, record);
    }
  });
  requestSync();
}

/** Local-only sync-error marker (never synced). */
export async function setSyncError(id: string, error: string | null): Promise<void> {
  await getDb().update(schema.assets).set({ syncError: error }).where(eq(schema.assets.id, id));
}
