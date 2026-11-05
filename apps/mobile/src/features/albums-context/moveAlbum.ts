import { type AlbumRecord, movePositions, positionsInOrder } from '@squidbox/shared';

import readAlbumsInCustomOrder from '@/features/album-list/readAlbumsInCustomOrder';
import type { AppDb } from '@/sync/db/driver';
import type { AlbumRow } from '@/sync/db/schema';
import type { makeRepository } from '@/sync/repository';

// A drop in the albums list: under Custom (the default) only where it landed; under another sort also
// the order on screen after it.
export type AlbumMove = { id: string; afterId: string | null } & (
  { sort?: 'custom'; order?: undefined } | { sort: string; order: string[] }
);

type AlbumsRepository = Pick<ReturnType<typeof makeRepository<AlbumRecord>>, 'updateMany'>;

/**
 * Puts album `id` right after album `afterId` (`null`: first) in the albums' custom order as the
 * database holds it, in one transaction, writing the new positions through `repo`, the albums
 * repository, so they sync like any album edit. `sort` is the sort the drop was made on: under
 * Custom only the moved album is written (movePositions); under another sort `order`, the album ids
 * as the screen shows them after the drop, becomes the custom order, replacing the old one (albums it
 * leaves out follow in their old order), as in Photos. The screen passes it because the album sorts
 * are comparators it runs over its rows. Throws when `id` is gone, or under Custom `afterId`, so the
 * grid undoes the drop. Resolves to the committed-write count that includes this write
 * (AppDb.committedWrites): rows read at or after it show the move.
 */
export default async function moveAlbum(
  db: AppDb,
  repo: AlbumsRepository,
  { id, afterId, order, sort = 'custom' }: AlbumMove,
): Promise<number> {
  await db.transaction(async (tx) => {
    const albums = await readAlbumsInCustomOrder(tx);
    const ids = new Set(albums.map((album) => album.id));
    // A sort but Custom comes with its order (AlbumMove); without one the move is by neighbour.
    const byNeighbour = sort === 'custom' || order === undefined;
    if (!ids.has(id) || (byNeighbour && afterId !== null && !ids.has(afterId)))
      throw new Error('The album or its neighbour is gone');
    const updates = byNeighbour ? movePositions(albums, id, afterId) : positionsInOrder(inOrder(albums, order));
    if (Object.keys(updates).length > 0) await repo.updateMany(tx, updates);
  });
  // Read before anything else can run: the next queued write starts only after this continuation.
  return db.committedWrites();
}

// The albums as `order` lists them, the ones it leaves out after them in their custom order.
function inOrder(albums: AlbumRow[], order: string[]): AlbumRow[] {
  const rank = new Map(order.map((albumId, index) => [albumId, index]));
  return [...albums].sort((a, b) => (rank.get(a.id) ?? order.length) - (rank.get(b.id) ?? order.length));
}
