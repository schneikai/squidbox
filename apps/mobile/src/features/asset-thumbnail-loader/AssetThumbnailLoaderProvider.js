import * as Sentry from '@sentry/react-native';
import { useCallback, useMemo, useRef } from 'react';

import AssetThumbnailLoaderContext from './AssetThumbnailLoaderContext';

import useCloud from '@/features/cloud/useCloud';

// Report the first handful of thumbnail failures per session, then go quiet — enough to diagnose a
// systemic problem (e.g. missing S3 objects, auth) without flooding Sentry during a launch storm.
let reportedFailures = 0;
const MAX_REPORTED_FAILURES = 5;

// Lazy, bounded thumbnail loader. Screens (see AssetImage) call loadThumbnail(asset) for the cells
// that scroll into view; each cell already checks the disk first and only asks for what's missing.
// We download those in small batches behind a hard concurrency cap, so even a large library
// (10k+ assets) can never fan out into thousands of parallel S3 downloads — that used to stall the
// device and crash the app. Nothing is preloaded up front; we only fetch what a screen requests.
const BATCH_SIZE = 12; // thumbnails presigned + fetched per drain (one presign call per batch)
const MAX_ACTIVE_BATCHES = 2; // hard cap on batches in flight at once

export default function AssetThumbnailLoaderProvider({ children }) {
  const { isAuthenticated, preloadAssetThumbnailsAsync } = useCloud();

  // Queue + bookkeeping live in refs, not state, so requesting a thumbnail never re-renders the
  // whole subtree (a grid can enqueue hundreds of cells while scrolling).
  const queueRef = useRef([]); // assets waiting to load (a stack — newest-visible drained first)
  const trackedRef = useRef(new Set()); // thumbnailFilenames queued or in flight (dedupe)
  const activeBatchesRef = useRef(0);

  const pump = useCallback(() => {
    if (!isAuthenticated) return;
    while (activeBatchesRef.current < MAX_ACTIVE_BATCHES && queueRef.current.length > 0) {
      const batch = queueRef.current.splice(-BATCH_SIZE).reverse(); // newest-requested first
      activeBatchesRef.current += 1;
      Promise.resolve(preloadAssetThumbnailsAsync(batch))
        .catch((err) => {
          // Best-effort — the key is freed below so a still-visible cell retries on its next poll.
          // Surface the reason (was silently swallowed) so a systemic failure is diagnosable.
          if (reportedFailures < MAX_REPORTED_FAILURES) {
            reportedFailures += 1;
            Sentry.captureException(err);
          }
        })
        .finally(() => {
          for (const asset of batch) trackedRef.current.delete(asset.thumbnailFilename);
          activeBatchesRef.current -= 1;
          pump(); // drain whatever queued while this batch ran
        });
    }
  }, [isAuthenticated, preloadAssetThumbnailsAsync]);

  const loadThumbnail = useCallback(
    (asset) => {
      const key = asset?.thumbnailFilename;
      if (!key || trackedRef.current.has(key)) return; // no key, or already queued/in flight
      trackedRef.current.add(key);
      queueRef.current.push(asset);
      pump();
    },
    [pump],
  );

  const value = useMemo(() => ({ loadThumbnail }), [loadThumbnail]);

  return <AssetThumbnailLoaderContext.Provider value={value}>{children}</AssetThumbnailLoaderContext.Provider>;
}
