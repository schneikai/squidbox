import useAlbums from '@/features/albums-context/useAlbums';

/**
 * Reorders albums with a numeric name from highest to lowest (e.g. 230, 220,
 * 210) so the list looks like the numbered shot albums were uploaded in
 * sequence. Albums without a numeric name keep their exact position.
 *
 * The albums list is sorted by createdAt (newest first), so we only shuffle the
 * createdAt values among the numeric albums' existing slots. Non-numeric albums
 * are never touched.
 */
export default function useResortAlbumsByName() {
  const { albums, updateManyAlbums } = useAlbums();

  async function resortAlbumsByNameAsync() {
    const realAlbums = Object.values(albums).filter((album) => !album.smartAlbumType);

    // Current display order: newest createdAt first.
    const currentOrder = [...realAlbums].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));

    const numericAlbums = currentOrder.filter((album) => isNumericName(album.name));
    const slotCreatedAts = numericAlbums.map((album) => album.createdAt);

    // Highest number first so it lands in the newest (top) slot.
    const sortedDesc = [...numericAlbums].sort((a, b) => numericName(b.name) - numericName(a.name));

    const updates = {};
    sortedDesc.forEach((album, index) => {
      updates[album.id] = { createdAt: slotCreatedAts[index] };
    });

    await updateManyAlbums(updates);

    return sortedDesc.length;
  }

  return resortAlbumsByNameAsync;
}

function isNumericName(name) {
  return /^\d+$/.test((name ?? '').trim());
}

function numericName(name) {
  return Number((name ?? '').trim());
}
