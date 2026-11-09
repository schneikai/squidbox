import { and, isNull, sql } from 'drizzle-orm';

import { heldPhotoIds, type PhotosOf } from './assetSql';
import * as schema from './db/schema';
import type { SyncDb } from './db/types';

/** The ids of the live, untrashed photos of an album or post. */
export default async function readPhotoIdsOf(tx: SyncDb, of: PhotosOf): Promise<string[]> {
  const a = schema.assets;
  const rows = await tx
    .select({ id: a.id })
    .from(a)
    .where(and(isNull(a.deletedAt), sql`${a.id} in ${heldPhotoIds(of)}`));
  return rows.map((row) => row.id);
}
