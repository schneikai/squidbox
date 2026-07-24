import useAlbums from '@/features/albums-context/useAlbums';

// Spacing between generated timestamps. Keeps createdAt values distinct and
// monotonic so the album order follows the numeric name order.
const STEP_MS = 60_000;

/**
 * Rewrites createdAt for all real (non-smart) albums so their order follows the
 * numeric name order (e.g. 210, 220, 230), regardless of the original upload
 * order. Higher name = newer createdAt.
 */
export default function useResortAlbumsByName() {
  const { albums, updateManyAlbums } = useAlbums();

  async function resortAlbumsByNameAsync() {
    const realAlbums = Object.values(albums).filter((album) => !album.smartAlbumType);

    const sorted = [...realAlbums].sort((a, b) =>
      (a.name || '').localeCompare(b.name || '', undefined, { numeric: true, sensitivity: 'base' }),
    );

    const existingCreatedAts = sorted.map((album) => album.createdAt).filter((value) => typeof value === 'number');
    const base = existingCreatedAts.length > 0 ? Math.min(...existingCreatedAts) : Date.now();

    const updates = {};
    sorted.forEach((album, index) => {
      updates[album.id] = { createdAt: base + index * STEP_MS };
    });

    await updateManyAlbums(updates);

    return sorted.length;
  }

  return resortAlbumsByNameAsync;
}
