import { movePositions } from '@squidbox/shared';

import readAlbumsInCustomOrder from '@/features/album-list/readAlbumsInCustomOrder';

/**
 * Puts album `id` right after album `afterId` (`null`: first) in the albums' custom order as the
 * database holds it, in one transaction, writing the new positions (movePositions) through `repo`,
 * the albums repository, so they sync like any album edit. Resolves to the committed-write count
 * that includes this write (AppDb.committedWrites): rows read at or after it show the move.
 */
export default async function moveAlbum(db, repo, { id, afterId }) {
  await db.transaction(async (tx) => {
    const updates = movePositions(await readAlbumsInCustomOrder(tx), id, afterId);
    if (Object.keys(updates).length > 0) await repo.updateMany(tx, updates);
  });
  // Read before anything else can run: the next queued write starts only after this continuation.
  return db.committedWrites();
}
