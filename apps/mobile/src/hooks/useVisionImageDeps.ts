import { useMemo } from 'react';

import useCloud from '@/features/cloud/useCloud';
import useOpenLibrary from '@/library/useOpenLibrary';
import type { VisionImageReadDeps } from '@/utils/assets/readVisionImageAsync';

/**
 * What readVisionImageAsync reads a thumbnail with, `{ library, isAuthenticated,
 * preloadAssetThumbnailsAsync }` (useLibrary's paths, useCloud's), stable while they are.
 */
export default function useVisionImageDeps(): VisionImageReadDeps {
  const { paths: library } = useOpenLibrary();
  const { isAuthenticated, preloadAssetThumbnailsAsync } = useCloud();
  return useMemo(
    () => ({ library, isAuthenticated, preloadAssetThumbnailsAsync }),
    [library, isAuthenticated, preloadAssetThumbnailsAsync],
  );
}
