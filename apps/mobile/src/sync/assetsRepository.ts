import { eq, inArray, isNull } from 'drizzle-orm';
import type { AssetRecord } from '@squidbox/shared';
import * as schema from './db/schema';
import type { AssetRow } from './db/schema';
import type { SyncDb } from './db/types';
import { enqueueMutation } from './outbox';
import { nextUpdatedAt } from './clock';

const COLLECTION = 'assets';

function toRecord(row: AssetRow): AssetRecord {
  const { syncError: _syncError, ...record } = row;
  return record as unknown as AssetRecord;
}

function stripLocal(row: AssetRow) {
  const { syncError: _s, ...wireRecord } = row;
  return wireRecord;
}

/** All live (non-tombstoned) assets, id-keyed — matches the shape screens consume. */
export async function loadAssetsMap(db: SyncDb): Promise<Record<string, AssetRecord>> {
  const rows = await db.select().from(schema.assets).where(isNull(schema.assets.deletedAt));
  const map: Record<string, AssetRecord> = {};
  for (const row of rows) map[row.id] = toRecord(row);
  return map;
}

// SQLite transactions on drizzle (expo-sqlite + better-sqlite3) are SYNCHRONOUS: the callback
// must not be async, and queries execute via .run()/.get()/.all(). An async callback would
// commit before its awaits resolve (non-atomic). All row+outbox writes below use this pattern.

/** Create a new asset (full synced record). Row + outbox in one transaction. */
export async function createAsset(db: SyncDb, record: AssetRecord): Promise<AssetRecord> {
  const row: AssetRow = { ...record, updatedAt: nextUpdatedAt(record.updatedAt), syncError: null };
  db.transaction((tx) => {
    tx.insert(schema.assets).values(row).run();
    enqueueMutation(tx as unknown as SyncDb, COLLECTION, stripLocal(row));
  });
  return toRecord(row);
}

/** Patch synced fields of one asset (reads prev for the monotonic clock). */
export async function updateAsset(db: SyncDb, id: string, changes: Partial<AssetRecord>): Promise<void> {
  db.transaction((tx) => {
    const prev = tx.select().from(schema.assets).where(eq(schema.assets.id, id)).get();
    if (!prev) return;
    const next: AssetRow = { ...prev, ...changes, updatedAt: nextUpdatedAt(prev.updatedAt) };
    tx.update(schema.assets).set(next).where(eq(schema.assets.id, id)).run();
    enqueueMutation(tx as unknown as SyncDb, COLLECTION, stripLocal(next));
  });
}

export async function toggleFavorite(db: SyncDb, id: string): Promise<void> {
  const row = await db.select().from(schema.assets).where(eq(schema.assets.id, id)).get();
  if (row) await updateAsset(db, id, { isFavorite: !row.isFavorite });
}

/** Soft-delete (tombstone): set deletedAt. Binary/thumbnail cleanup is the caller's job. */
export async function deleteAssets(db: SyncDb, ids: string[]): Promise<void> {
  db.transaction((tx) => {
    const rows = tx.select().from(schema.assets).where(inArray(schema.assets.id, ids)).all();
    for (const prev of rows) {
      const ts = nextUpdatedAt(prev.updatedAt);
      const next: AssetRow = { ...prev, updatedAt: ts, deletedAt: ts };
      tx.update(schema.assets).set(next).where(eq(schema.assets.id, prev.id)).run();
      enqueueMutation(tx as unknown as SyncDb, COLLECTION, stripLocal(next));
    }
  });
}

/** Local-only sync-error marker (never synced). */
export async function setSyncError(db: SyncDb, id: string, error: string | null): Promise<void> {
  await db.update(schema.assets).set({ syncError: error }).where(eq(schema.assets.id, id));
}
