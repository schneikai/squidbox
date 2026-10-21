import { and, isNotNull, isNull, not, or, sql, type SQL } from 'drizzle-orm';

import type { RemoveFiles } from './assetsRepository';
import { SQL_BATCH } from './chunk';
import * as schema from './db/schema';
import type { SyncDb } from './db/types';
import { inJson } from './inJson';
import type { AssetFileNames } from '../library/fs';

// An asset whose purge waits for the server: its pending outbox row carries the deletion pair.
const pendingPurge = sql`exists (select 1 from ${schema.outbox} where ${schema.outbox.collection} = 'assets'
  and ${schema.outbox.recordId} = ${schema.assets.id} and json_extract(${schema.outbox.fields}, '$.purgedAt') is not null)`;

/**
 * Removes this device's copies of the purged assets whose files it still has, once their purge is
 * confirmed (sync-design §7a): it came from the server, or the library has no account, so nothing can
 * restore it. Only the names no other asset still uses go, and each asset is marked `filesRemovedAt`.
 * Runs after every push batch and pull commit, at boot and after a purge.
 */
export async function sweepPurgedFiles(
  db: SyncDb,
  removeFiles: RemoveFiles,
  { hasAccount = true }: { hasAccount?: boolean } = {},
): Promise<void> {
  for (;;) {
    const rows = await db
      .select()
      .from(schema.assets)
      .where(
        and(
          isNotNull(schema.assets.purgedAt),
          isNull(schema.assets.filesRemovedAt),
          hasAccount ? not(pendingPurge) : undefined,
        ),
      )
      .limit(SQL_BATCH);
    if (rows.length === 0) return;
    await removeFiles(await unsharedFiles(db, rows, hasAccount ? pendingPurge : undefined));
    await db
      .update(schema.assets)
      .set({ filesRemovedAt: Date.now() })
      .where(
        inJson(
          schema.assets.id,
          rows.map((row) => row.id),
        ),
      );
  }
}

/**
 * The file names of these assets that no other asset still uses (one that isn't purged, or whose purge
 * waits for the server), in one statement, as the server keeps a key in use (§7a).
 */
async function unsharedFiles(
  db: SyncDb,
  rows: schema.AssetRow[],
  unconfirmed: SQL | undefined,
): Promise<AssetFileNames[]> {
  const names = [...new Set(rows.flatMap((row) => [row.filename, row.thumbnailFilename]))];
  const sharing = await db
    .select({ filename: schema.assets.filename, thumbnailFilename: schema.assets.thumbnailFilename })
    .from(schema.assets)
    .where(
      and(
        unconfirmed ? or(isNull(schema.assets.purgedAt), unconfirmed) : isNull(schema.assets.purgedAt),
        not(
          inJson(
            schema.assets.id,
            rows.map((row) => row.id),
          ),
        ),
        or(inJson(schema.assets.filename, names), inJson(schema.assets.thumbnailFilename, names)),
      ),
    );
  const inUse = new Set(sharing.flatMap((row) => [row.filename, row.thumbnailFilename]));
  const unshared = (name: string) => (name && !inUse.has(name) ? name : undefined);
  return rows.map((row) => ({ filename: unshared(row.filename), thumbnailFilename: unshared(row.thumbnailFilename) }));
}
