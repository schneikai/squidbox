import type { ContactLinkRecord } from '@squidbox/shared';
import { useMemo } from 'react';

import useContactRows from '@/features/contact-list/useContactRows';

/**
 * The contacts of a photo, album or post, live, by name: the ones on it and, for an album or post,
 * the ones on its untrashed photos. `onPhotoIds` are those on any of its photos. Undefined while reading.
 * `isLive: false` reads them once (useContactRows's).
 */
export default function useTargetContacts(
  targetType: ContactLinkRecord['targetType'],
  targetId: string,
  { isLive }: { isLive?: boolean } = {},
) {
  const hasPhotos = targetType !== 'asset';
  const linked = useContactRows({ scope: { targetType, targetId } }, { isLive });
  // A photo has no photos of its own: a read of nothing, once, so the hooks stay the same.
  const onPhotos = useContactRows(
    { scope: hasPhotos ? { photosOf: targetType, id: targetId } : { targetType, targetId: [] } },
    { isLive: hasPhotos && isLive },
  );

  return useMemo(() => {
    if (!linked || !onPhotos) return undefined;
    const onPhotoIds = new Set(onPhotos.map((contact) => contact.id));
    const contacts = [...onPhotos, ...linked.filter((contact) => !onPhotoIds.has(contact.id))].sort(
      (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) || a.id.localeCompare(b.id),
    );
    return { contacts, onPhotoIds };
  }, [linked, onPhotos]);
}
