import { router } from 'expo-router';
import { type ReactNode, useCallback, useMemo, useRef } from 'react';

import type { AssetExclude } from '@/features/asset-list/assetQuery';
import AssetPickerContext, { type AssetPickerValue } from '@/features/asset-picker/AssetPickerContext';
import type { AssetRow } from '@/sync/db/schema';

export type AssetPickerProviderProps = { children: ReactNode };

// The picker's promise for useAssetPicker: openAssetPicker() resolves when the picker screen
// (AssetPickerScreen) calls finishAssetPicking().
export default function AssetPickerProvider({ children }: AssetPickerProviderProps) {
  const resolveRef = useRef<((assets: AssetRow[]) => void) | null>(null);

  // Works like the system image picker: resolves with the picked assets, or with none when the picker
  // closes without Add. What the post or album already holds doesn't show: `exclude` as in assetQuery,
  // a post's few ids or `{ albumId }`.
  const openAssetPicker = useCallback(
    ({ exclude = [] }: { exclude?: AssetExclude } = {}) =>
      new Promise<AssetRow[]>((resolve) => {
        resolveRef.current = resolve;
        router.navigate({ pathname: '/pick-assets', params: pickerParams(exclude) });
      }),
    [],
  );

  // Settles the open picker once: the picker closing after Add settles it again, which does nothing.
  const finishAssetPicking = useCallback((assets: AssetRow[]) => {
    resolveRef.current?.(assets);
    resolveRef.current = null;
  }, []);

  const value = useMemo<AssetPickerValue>(
    () => ({ openAssetPicker, finishAssetPicking }),
    [openAssetPicker, finishAssetPicking],
  );

  return <AssetPickerContext value={value}>{children}</AssetPickerContext>;
}

// What to leave out, as the picker's URL params (AssetPickerScreen reads them back).
function pickerParams(exclude: AssetExclude) {
  if (!Array.isArray(exclude)) return { excludeAlbumId: exclude.albumId };
  return exclude.length ? { exclude: exclude.join(',') } : {};
}
