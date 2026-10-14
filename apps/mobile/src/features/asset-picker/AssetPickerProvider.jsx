import { useNavigation } from '@react-navigation/native';
import { useState, useCallback, useMemo, useRef } from 'react';

import useToggleSelectAssetsAction from '@/features/asset-list/actions/toggle-select-assets-action/useToggleSelectAssetsAction';
import AssetPickerContext from '@/features/asset-picker/AssetPickerContext';
import { getDb, schema } from '@/sync/db/client';
import { readByIds } from '@/sync/readByIds';

export default function AssetPickerProvider({ children }) {
  const navigation = useNavigation();
  const { selectedAssetIds, isAssetSelected, toggleSelectAsset, selectAssets } = useToggleSelectAssetsAction();
  // All AssetPicker screens use the same header that is created in AssetPickerScreen.
  // When we are inside a album tho we need to show the album name in the header
  // and a back button. These props are set in AlbumScreen onFocus and used in
  // AssetPickerScreen to configure the header.
  const [albumScreenProps, setAlbumScreenProps] = useState(null);
  const onClosePromiseResolveRef = useRef();

  const cleanUpAndClose = useCallback(() => {
    selectAssets([]);
    onClosePromiseResolveRef.current = null;
    setAlbumScreenProps(null);
  }, [selectAssets]);

  // openAssetPicker works like the build-in image picker and returns
  // a promise that resolves with the selected assets.
  const openAssetPicker = useCallback(() => {
    return new Promise((resolve) => {
      onClosePromiseResolveRef.current = resolve;
      navigation.navigate('AssetPickerModal');
    });
  }, [navigation]);

  const onConfirmSelection = useCallback(async () => {
    const assets = await readByIds(getDb(), schema.assets, selectedAssetIds);
    onClosePromiseResolveRef.current({ canceled: false, assets });
    cleanUpAndClose();
  }, [selectedAssetIds, cleanUpAndClose]);

  const onCancelSelection = useCallback(() => {
    onClosePromiseResolveRef.current({ canceled: true, assets: [] });
    cleanUpAndClose();
  }, [cleanUpAndClose]);

  const value = useMemo(
    () => ({
      openAssetPicker,
      toggleSelectAsset,
      selectedAssetIds,
      isAssetSelected,
      albumScreenProps,
      setAlbumScreenProps,
      onConfirmSelection,
      onCancelSelection,
    }),
    [
      openAssetPicker,
      toggleSelectAsset,
      selectedAssetIds,
      isAssetSelected,
      albumScreenProps,
      onConfirmSelection,
      onCancelSelection,
    ],
  );

  return <AssetPickerContext.Provider value={value}>{children}</AssetPickerContext.Provider>;
}
