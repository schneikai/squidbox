import { and, isNull, ne, sql } from 'drizzle-orm';

import { livePhotoIdsOf, type PhotosOf } from './assetSql';
import { tombstone } from './clock';
import * as schema from './db/schema';
import type { SyncDb } from './db/types';
import { contactLinks } from './membershipRepository';
import { saveRecords } from './saveRecords';

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

/**
 * Moves the contacts an older build put on an album or post itself onto its photos, as they are
 * now, and tombstones those links: one transaction, a no-op once none is left. True when it wrote.
 * A link to a deleted album or post only goes.
 */
export function moveGroupLinksToPhotos(db: SyncDb, newId: () => string): Promise<boolean> {
  const l = schema.contactLinks;
  return db.transaction(async (tx) => {
    const links = await tx
      .select()
      .from(l)
      .where(and(ne(l.targetType, 'asset'), isNull(l.deletedAt)));
    if (links.length === 0) return false;
    for (const link of links) {
      const of: PhotosOf = link.targetType === 'album' ? { albumId: link.targetId } : { postId: link.targetId };
      await addToPhotos(tx, await readPhotoIdsOf(tx, of), [link.contactId], newId);
    }
    await saveRecords(tx, 'contact_links', l, links.map(tombstone), { previous: links });
    return true;
  });
}

function asPhoto(targetId: string) {
  return { targetType: 'asset', targetId };
}
