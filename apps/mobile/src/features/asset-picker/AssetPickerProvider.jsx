import { router } from 'expo-router';
import { useCallback, useMemo, useRef } from 'react';

import AssetPickerContext from '@/features/asset-picker/AssetPickerContext';

export default function AssetPickerProvider({ children }) {
  const resolveRef = useRef(null);

  // Works like the system image picker: resolves with the picked assets, or with none when the picker
  // closes without Add. What the post or album already holds doesn't show: `exclude` as in assetQuery,
  // a post's few ids or `{ albumId }`.
  const openAssetPicker = useCallback(
    ({ exclude = [] } = {}) =>
      new Promise((resolve) => {
        resolveRef.current = resolve;
        router.navigate({ pathname: '/pick-assets', params: pickerParams(exclude) });
      }),
    [],
  );

  // Settles the open picker once: the picker closing after Add settles it again, which does nothing.
  const finishAssetPicking = useCallback((assets) => {
    resolveRef.current?.(assets);
    resolveRef.current = null;
  }, []);

  const value = useMemo(() => ({ openAssetPicker, finishAssetPicking }), [openAssetPicker, finishAssetPicking]);

  return <AssetPickerContext value={value}>{children}</AssetPickerContext>;
}

// What to leave out, as the picker's URL params (AssetPickerScreen reads them back).
function pickerParams(exclude) {
  if (exclude.albumId) return { excludeAlbumId: exclude.albumId };
  return exclude.length ? { exclude: exclude.join(',') } : {};
}
