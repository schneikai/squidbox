import { sql } from 'drizzle-orm';

import { livePhotoIdsOf, type PhotosOf } from './assetSql';
import * as schema from './db/schema';
import type { SyncDb } from './db/types';
import { contactLinks } from './membershipRepository';

// Contacts go on photos only: an album or post lists the contacts on its photos. These write
// contact_links for photos, in the caller's transaction; `newId` is injected (the app passes
// getNewItemId).

/** The ids of the live, untrashed photos of an album or post (livePhotoIdsOf). */
export async function readPhotoIdsOf(tx: SyncDb, of: PhotosOf): Promise<string[]> {
  const a = schema.assets;
  const rows = await tx
    .select({ id: a.id })
    .from(a)
    .where(sql`${a.id} in ${livePhotoIdsOf(of)}`);
  return rows.map((row) => row.id);
}

/** Puts the contacts on every one of the photos; those already on one stay as they are. */
export function addToPhotos(tx: SyncDb, photoIds: string[], contactIds: string[], newId: () => string) {
  return contactLinks.addToEach(tx, photoIds.map(asPhoto), contactIds, newId);
}

/** Takes the contacts off every one of the photos. */
export function removeFromPhotos(tx: SyncDb, photoIds: string[], contactIds: string[]) {
  return contactLinks.removeFromEach(tx, photoIds.map(asPhoto), contactIds);
}

function asPhoto(targetId: string) {
  return { targetType: 'asset', targetId };
}
