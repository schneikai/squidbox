import useContactRows from '@/features/contact-list/useContactRows';

/**
 * The contacts in an album, live: the ones on its untrashed photos and any put on the album itself
 * (from before only photos were tagged), by name. Undefined while reading.
 */
export default function useAlbumPeople(albumId: string) {
  const onAlbum = useContactRows({ scope: { targetType: 'album', targetId: albumId } });
  const onPhotos = useContactRows({ scope: { photosOf: 'album', id: albumId } });

  if (!onAlbum || !onPhotos) return undefined;
  const onPhotoIds = new Set(onPhotos.map((contact) => contact.id));
  return [...onPhotos, ...onAlbum.filter((contact) => !onPhotoIds.has(contact.id))].sort(
    (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) || a.id.localeCompare(b.id),
  );
}
