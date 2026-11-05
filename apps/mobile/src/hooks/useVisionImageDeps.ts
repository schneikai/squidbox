import { useMemo } from 'react';

import useCloud from '@/features/cloud/useCloud';
import useLibrary from '@/library/useLibrary';
import type { VisionImageDeps } from '@/utils/assets/readVisionImageAsync';

/**
 * What readVisionImageAsync reads a thumbnail with, `{ library, isAuthenticated,
 * preloadAssetThumbnailsAsync }` (useLibrary's paths, useCloud's), stable while they are.
 */
export default function useVisionImageDeps(): Omit<VisionImageDeps, 'signal'> {
  const { paths } = useLibrary();
  // Below LibraryGate a library is always open.
  const library = paths!;
  const { isAuthenticated, preloadAssetThumbnailsAsync } = useCloud();
  return useMemo(
    () => ({ library, isAuthenticated, preloadAssetThumbnailsAsync }),
    [library, isAuthenticated, preloadAssetThumbnailsAsync],
  );
}
