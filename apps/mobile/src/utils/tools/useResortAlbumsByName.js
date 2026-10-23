import { positionsInOrder } from '@squidbox/shared';

import readAlbumsInCustomOrder from '@/features/album-list/readAlbumsInCustomOrder';
import useAlbums from '@/features/albums-context/useAlbums';
import { getDb } from '@/sync/db/client';

/**
 * Reorders albums with a numeric name from highest to lowest (e.g. 230, 220, 210) so the list looks
 * like the numbered shot albums were uploaded in sequence. Albums without a numeric name keep their
 * exact position.
 *
 * Works on the albums' custom order (their synced `position`): the numeric albums swap into each
 * other's slots, then the albums out of that order get new positions (positionsInOrder); only those are written.
 * Returns the number of numeric albums.
 */
export default function useResortAlbumsByName() {
  const { updateManyAlbums } = useAlbums();

  async function resortAlbumsByNameAsync() {
    const currentOrder = await readAlbumsInCustomOrder(getDb());

    // Highest number first, into the numeric albums' slots in the current order.
    const numericDesc = currentOrder
      .filter((album) => isNumericName(album.name))
      .sort((a, b) => numericName(b.name) - numericName(a.name));
    let next = 0;
    const newOrder = currentOrder.map((album) => (isNumericName(album.name) ? numericDesc[next++] : album));

    await updateManyAlbums(positionsInOrder(newOrder));

    return numericDesc.length;
  }

  return resortAlbumsByNameAsync;
}

function isNumericName(name) {
  return /^\d+$/.test((name ?? '').trim());
}

function numericName(name) {
  return Number((name ?? '').trim());
}
