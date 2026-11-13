import * as Sentry from '@sentry/react-native';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

import AssetThumbnailLoaderContext, { type AvatarItem } from './AssetThumbnailLoaderContext';
import createThumbnailQueue from './createThumbnailQueue';

import useOpenLibrary from '@/library/useOpenLibrary';
import useCloud from '@/providers/cloud/useCloud';
import { getAvatarUri, hasAvatarAsync } from '@/utils/assets/assetStorage';
import type { ThumbnailStatusAsset } from '@/utils/assets/thumbnails/getAssetThumbnailStatusAsync';
import preloadFilesAsync from '@/utils/cloud-api/assets/preloadFilesAsync';

// Report the first handful of thumbnail failures per session, then go quiet — enough to diagnose a
// systemic problem (e.g. missing S3 objects, auth) without flooding Sentry during a launch storm.
let reportedFailures = 0;
const MAX_REPORTED_FAILURES = 5;

function reportFailure(error: unknown) {
  if (reportedFailures >= MAX_REPORTED_FAILURES) return;
  reportedFailures += 1;
  Sentry.captureException(error);
}

const AVATARS = { hasAsync: hasAvatarAsync, uriOf: getAvatarUri };

type AssetThumbnailLoaderProviderProps = { children: ReactNode };

// Lazy, bounded loader of the files the screen shows from the user's storage (see
// createThumbnailQueue): AssetImage asks it for the thumbnails of the cells in view, ContactAvatar for
// the contacts' photos (`loadAvatar({ avatarFilename }, onResult)`), each kind in its own queue.
export default function AssetThumbnailLoaderProvider({ children }: AssetThumbnailLoaderProviderProps) {
  const { isAuthenticated, preloadAssetThumbnailsAsync } = useCloud();
  const { paths } = useOpenLibrary();
  // Made once and never set: requesting a file re-renders nothing (a grid can request hundreds of
  // cells while scrolling).
  const [queues] = useState(() => ({
    thumbnails: createThumbnailQueue<ThumbnailStatusAsset>({
      keyOf: (asset) => asset.thumbnailFilename,
      load: (assets, signal) => preloadAssetThumbnailsAsync(assets, paths, signal),
      onError: reportFailure,
    }),
    avatars: createThumbnailQueue<AvatarItem>({
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
