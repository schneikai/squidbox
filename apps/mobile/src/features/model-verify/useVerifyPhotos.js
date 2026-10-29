import { useEffect, useState } from 'react';

import fetchVerifyPhotosAsync from '@/utils/cloud-api/ai/fetchVerifyPhotosAsync';
import apiErrorMessage from '@/utils/cloud-api/apiErrorMessage';

// The photos, read once per app session (they never change): every Verify page shares the one read.
let photosPromise = null;

/**
 * The vision Verify's photos: `photos` file name → data URL, null until they're in (or when the read
 * failed: the page shows the empty boxes, and `error` the reason).
 */
export default function useVerifyPhotos() {
  const [state, setState] = useState({ photos: null, error: null });

  useEffect(() => {
    let isCurrent = true;
    photosPromise ??= fetchVerifyPhotosAsync().catch((error) => {
      photosPromise = null;
      throw error;
    });
    photosPromise.then(
      (photos) => isCurrent && setState({ photos, error: null }),
      (error) => {
        console.error("Loading Verify's photos failed", error);
        if (isCurrent) setState({ photos: null, error: apiErrorMessage(error) });
      },
    );
    return () => {
      isCurrent = false;
    };
  }, []);

  return state;
}
