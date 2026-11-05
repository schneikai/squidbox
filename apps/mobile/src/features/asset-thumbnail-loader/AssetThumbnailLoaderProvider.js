import * as Sentry from '@sentry/react-native';
import { useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

import AssetThumbnailLoaderContext from './AssetThumbnailLoaderContext';
import createThumbnailQueue from './createThumbnailQueue';

import preloadFilesAsync from '@/features/cloud/assets/preloadFilesAsync';
import useCloud from '@/features/cloud/useCloud';
import useLibrary from '@/library/useLibrary';
import { getAvatarUri, hasAvatarAsync } from '@/utils/assets/assetStorage';

// Report the first handful of thumbnail failures per session, then go quiet — enough to diagnose a
// systemic problem (e.g. missing S3 objects, auth) without flooding Sentry during a launch storm.
let reportedFailures = 0;
const MAX_REPORTED_FAILURES = 5;

function reportFailure(error) {
  if (reportedFailures >= MAX_REPORTED_FAILURES) return;
  reportedFailures += 1;
  Sentry.captureException(error);
}

const AVATARS = { hasAsync: hasAvatarAsync, uriOf: getAvatarUri };

// Lazy, bounded loader of the files the screen shows from the user's storage (see
// createThumbnailQueue): AssetImage asks it for the thumbnails of the cells in view, ContactAvatar for
// the contacts' photos (`loadAvatar({ avatarFilename }, onResult)`), each kind in its own queue.
export default function AssetThumbnailLoaderProvider({ children }) {
  const { isAuthenticated, preloadAssetThumbnailsAsync } = useCloud();
  const { paths } = useLibrary();
  // Made once and never set: requesting a file re-renders nothing (a grid can request hundreds of
  // cells while scrolling).
  const [queues] = useState(() => ({
    thumbnails: createThumbnailQueue({
      load: (assets, signal) => preloadAssetThumbnailsAsync(assets, paths, signal),
      onError: reportFailure,
    }),
    avatars: createThumbnailQueue({
      keyOf: (contact) => contact.avatarFilename,
      load: (contacts, signal) =>
        preloadFilesAsync(
          contacts.map((contact) => contact.avatarFilename),
          AVATARS,
          paths,
          signal,
        ),
      onError: reportFailure,
    }),
  }));

  useEffect(() => {
    for (const queue of Object.values(queues)) queue.setEnabled(isAuthenticated);
  }, [queues, isAuthenticated]);

  // Back in the foreground, the files that failed get another chance; a library switch unmounts the
  // provider, and the old library's loads stop with it.
  useEffect(() => {
    const all = Object.values(queues);
    const subscription = AppState.addEventListener(
      'change',
      (state) => state === 'active' && all.forEach((queue) => queue.retryFailed()),
    );
    return () => {
      subscription.remove();
      for (const queue of all) queue.dispose();
    };
  }, [queues]);

  const value = useMemo(
    () => ({ loadThumbnail: queues.thumbnails.request, loadAvatar: queues.avatars.request }),
    [queues],
  );

  return <AssetThumbnailLoaderContext.Provider value={value}>{children}</AssetThumbnailLoaderContext.Provider>;
}
