import { keysInOrder, movePositions } from '@squidbox/shared';

import readAlbumsInCustomOrder from '@/features/album-list/readAlbumsInCustomOrder';

/**
 * Puts album `id` right after album `afterId` (`null`: first) in the albums' custom order as the
 * database holds it, in one transaction, writing the new positions (movePositions) through `repo`,
 * the albums repository, so they sync like any album edit. A drag under another sort passes `order`,
 * the album ids as the screen shows them: that order, with the move, becomes the custom order,
 * replacing the old one (albums it leaves out follow in their old order), as in Photos. The screen
 * passes it because the album sorts are comparators it runs over its rows. Resolves to the
 * committed-write count that includes this write (AppDb.committedWrites): rows read at or after it
 * show the move.
 */
export default async function moveAlbum(db, repo, { id, afterId, order }) {
  await db.transaction(async (tx) => {
    const albums = await readAlbumsInCustomOrder(tx);
    const updates = order ? adoptOrder(albums, order, id, afterId) : movePositions(albums, id, afterId);
    if (Object.keys(updates).length > 0) await repo.updateMany(tx, updates);
  });
  // Read before anything else can run: the next queued write starts only after this continuation.
  return db.committedWrites();
}

// Positions for `order` with `id` moved right after `afterId`, rewriting only the albums out of that
// order (keysInOrder).
function adoptOrder(albums, order, id, afterId) {
  const byId = new Map(albums.map((album) => [album.id, album]));
  const listed = new Set(order);
  const ids = [...order, ...albums.map((album) => album.id).filter((albumId) => !listed.has(albumId))].filter(
    (albumId) => albumId !== id && byId.has(albumId),
  );
  const at = afterId === null ? 0 : ids.indexOf(afterId) + 1;
  if (!byId.has(id) || (afterId !== null && at === 0)) return {};
  ids.splice(at, 0, id);

  const keys = keysInOrder(ids.map((albumId) => byId.get(albumId).position));
  return Object.fromEntries(
    ids.flatMap((albumId, i) => (byId.get(albumId).position === keys[i] ? [] : [[albumId, { position: keys[i] }]])),
  );
}
