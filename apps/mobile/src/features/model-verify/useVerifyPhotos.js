import { useEffect, useState } from 'react';

import fetchVerifyPhotosAsync from '@/utils/cloud-api/ai/fetchVerifyPhotosAsync';

// The photos, read once per app session (they never change): every Verify page shares the one read.
// A failed read is logged and tried again by the next page.
let photosPromise = null;

/** The vision Verify's photos, file name → data URL; null until they're in, and after a failed read. */
export default function useVerifyPhotos() {
  const [photos, setPhotos] = useState(null);

  useEffect(() => {
    let isCurrent = true;
    photosPromise ??= fetchVerifyPhotosAsync().catch((error) => {
      photosPromise = null;
      throw error;
    });
    photosPromise.then(
      (loaded) => isCurrent && setPhotos(loaded),
      (error) => console.error("Loading Verify's photos failed", error),
    );
    return () => {
      isCurrent = false;
    };
  }, []);

  return photos;
}
