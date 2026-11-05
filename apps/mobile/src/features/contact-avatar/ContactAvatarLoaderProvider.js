import { useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

import ContactAvatarLoaderContext from './ContactAvatarLoaderContext';

import createThumbnailQueue from '@/features/asset-thumbnail-loader/createThumbnailQueue';
import preloadAvatarsAsync from '@/features/cloud/assets/preloadAvatarsAsync';
import useCloud from '@/features/cloud/useCloud';
import useLibrary from '@/library/useLibrary';

// Lazy, bounded loader of the contacts' photos from the user's storage, the thumbnails' queue keyed
// on `avatarFilename`: ContactAvatar asks it for the avatars on screen that aren't on the device.
export default function ContactAvatarLoaderProvider({ children }) {
  const { isAuthenticated } = useCloud();
  const { paths } = useLibrary();
  const [queue] = useState(() =>
    createThumbnailQueue({
      keyOf: (contact) => contact.avatarFilename,
      load: (contacts, signal) => preloadAvatarsAsync(contacts, paths, signal),
      onError: (error) => console.warn('Could not load contact photos', error),
    }),
  );

  useEffect(() => queue.setEnabled(isAuthenticated), [queue, isAuthenticated]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => state === 'active' && queue.retryFailed());
    return () => {
      subscription.remove();
      queue.dispose();
    };
  }, [queue]);

  const value = useMemo(() => ({ loadAvatar: queue.request }), [queue]);

  return <ContactAvatarLoaderContext.Provider value={value}>{children}</ContactAvatarLoaderContext.Provider>;
}
