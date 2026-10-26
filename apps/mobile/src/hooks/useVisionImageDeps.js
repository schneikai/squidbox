import { useMemo } from 'react';

import useCloud from '@/features/cloud/useCloud';
import useLibrary from '@/library/useLibrary';

/**
 * What readVisionImageAsync reads a thumbnail with, `{ library, isAuthenticated,
 * preloadAssetThumbnailsAsync }` (useLibrary's paths, useCloud's), stable while they are.
 */
export default function useVisionImageDeps() {
  const { paths: library } = useLibrary();
  const { isAuthenticated, preloadAssetThumbnailsAsync } = useCloud();
  return useMemo(
    () => ({ library, isAuthenticated, preloadAssetThumbnailsAsync }),
    [library, isAuthenticated, preloadAssetThumbnailsAsync],
  );
}
