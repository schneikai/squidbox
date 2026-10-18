import { useNavigation } from '@react-navigation/native';
import { useCallback, useMemo, useRef } from 'react';

import AssetPickerContext from '@/features/asset-picker/AssetPickerContext';

export default function AssetPickerProvider({ children }) {
  const navigation = useNavigation();
  const resolveRef = useRef(null);

  // Works like the system image picker: resolves with the picked assets, or with none when the picker
  // closes without Add. What the post or album already holds doesn't show: `exclude` as in assetQuery,
  // a post's few ids or `{ albumId }`.
  const openAssetPicker = useCallback(
    ({ exclude = [] } = {}) =>
      new Promise((resolve) => {
        resolveRef.current = resolve;
        navigation.navigate('AssetPickerModal', { exclude });
      }),
    [navigation],
  );

  // Settles the open picker once: the picker closing after Add settles it again, which does nothing.
  const finishAssetPicking = useCallback((assets) => {
    resolveRef.current?.(assets);
    resolveRef.current = null;
  }, []);

  const value = useMemo(() => ({ openAssetPicker, finishAssetPicking }), [openAssetPicker, finishAssetPicking]);

  return <AssetPickerContext value={value}>{children}</AssetPickerContext>;
}
