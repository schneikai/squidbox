import { router } from 'expo-router';
import { type ReactNode, useCallback, useMemo, useRef } from 'react';

import PhotoCropContext, { type CropPhoto, type PhotoCropValue } from '@/providers/photo-crop/PhotoCropContext';

export type PhotoCropProviderProps = { children: ReactNode };

// The crop's promise for usePhotoCrop: openPhotoCrop() opens the crop screen (PhotoCropScreen, a sheet,
// or a step inside the sheet it is opened from) and resolves when it calls finishPhotoCrop().
export default function PhotoCropProvider({ children }: PhotoCropProviderProps) {
  const resolveRef = useRef<((uri: string | null) => void) | null>(null);

  // Resolves with the square cut of `photo` the user chose, or with null when the screen closes
  // without Choose. A square photo has nothing to choose: it resolves with the photo at once.
  const openPhotoCrop = useCallback(
    ({ uri, width, height }: CropPhoto) =>
      new Promise<string | null>((resolve) => {
        if (width === height) return resolve(uri);
        resolveRef.current?.(null);
        resolveRef.current = resolve;
        router.navigate({ pathname: '/crop-photo', params: { uri, width, height } });
      }),
    [],
  );

  // Settles the open crop once: the screen closing after Choose settles it again, which does nothing.
  const finishPhotoCrop = useCallback((uri: string | null) => {
    resolveRef.current?.(uri);
    resolveRef.current = null;
  }, []);

  const value = useMemo<PhotoCropValue>(() => ({ openPhotoCrop, finishPhotoCrop }), [openPhotoCrop, finishPhotoCrop]);

  return <PhotoCropContext value={value}>{children}</PhotoCropContext>;
}
