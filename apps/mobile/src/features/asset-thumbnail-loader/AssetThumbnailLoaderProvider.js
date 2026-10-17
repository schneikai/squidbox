import * as Sentry from '@sentry/react-native';
import { useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

import AssetThumbnailLoaderContext from './AssetThumbnailLoaderContext';
import createThumbnailQueue from './createThumbnailQueue';

import useCloud from '@/features/cloud/useCloud';

// Report the first handful of thumbnail failures per session, then go quiet — enough to diagnose a
// systemic problem (e.g. missing S3 objects, auth) without flooding Sentry during a launch storm.
let reportedFailures = 0;
const MAX_REPORTED_FAILURES = 5;

function reportFailure(error) {
  if (reportedFailures >= MAX_REPORTED_FAILURES) return;
  reportedFailures += 1;
  Sentry.captureException(error);
}

// Lazy, bounded thumbnail loader: AssetImage asks it for the cells in view (see createThumbnailQueue).
export default function AssetThumbnailLoaderProvider({ children }) {
  const { isAuthenticated, preloadAssetThumbnailsAsync } = useCloud();
  // Made once and never set: requesting a thumbnail re-renders nothing (a grid can request hundreds
  // of cells while scrolling).
  const [queue] = useState(() => createThumbnailQueue({ load: preloadAssetThumbnailsAsync, onError: reportFailure }));

  useEffect(() => queue.setEnabled(isAuthenticated), [queue, isAuthenticated]);

  // Back in the foreground, the thumbnails that failed get another chance; a library switch unmounts
  // the provider, and the old library's loads stop with it.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => state === 'active' && queue.retryFailed());
    return () => {
      subscription.remove();
      queue.dispose();
    };
  }, [queue]);

  const value = useMemo(() => ({ loadThumbnail: queue.request }), [queue]);

  return <AssetThumbnailLoaderContext.Provider value={value}>{children}</AssetThumbnailLoaderContext.Provider>;
}
