import { initialKeys } from '@squidbox/shared';

import sortAlbumsByCustomOrder from '@/features/album-list/actions/sort-albums-action/sortAlbumsByCustomOrder';
import albumQuery from '@/features/album-list/albumQuery';
import useAlbums from '@/features/albums-context/useAlbums';
import { getDb } from '@/sync/db/client';

/**
 * Reorders albums with a numeric name from highest to lowest (e.g. 230, 220, 210) so the list looks
 * like the numbered shot albums were uploaded in sequence. Albums without a numeric name keep their
 * exact position.
 *
 * Works on the albums' custom order (their synced `position`): the numeric albums swap into each
 * other's slots, then every album gets a position in that order. Returns the number of numeric albums.
 */
export default function useResortAlbumsByName() {
  const { updateManyAlbums } = useAlbums();

  async function resortAlbumsByNameAsync() {
    const currentOrder = (await albumQuery({ scope: 'all' }).page(getDb())).sort(sortAlbumsByCustomOrder);

    // Highest number first, into the numeric albums' slots in the current order.
    const numericDesc = currentOrder
      .filter((album) => isNumericName(album.name))
      .sort((a, b) => numericName(b.name) - numericName(a.name));
    let next = 0;
    const newOrder = currentOrder.map((album) => (isNumericName(album.name) ? numericDesc[next++] : album));

    const positions = initialKeys(newOrder.length);
    await updateManyAlbums(Object.fromEntries(newOrder.map((album, i) => [album.id, { position: positions[i] }])));

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
