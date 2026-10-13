import { useNavigation } from '@react-navigation/native';
import { useState, useCallback, useMemo, useRef } from 'react';

import AssetPickerContext from '@/features/asset-picker/AssetPickerContext';

export default function AssetPickerProvider({ children }) {
  const navigation = useNavigation();
  const [selectedAssets, setSelectedAssets] = useState([]);
  // All AssetPicker screens use the same header that is created in AssetPickerScreen.
  // When we are inside a album tho we need to show the album name in the header
  // and a back button. These props are set in AlbumScreen onFocus and used in
  // AssetPickerScreen to configure the header.
  const [albumScreenProps, setAlbumScreenProps] = useState(null);
  const onClosePromiseResolveRef = useRef();

  const selectedIds = useMemo(() => new Set(selectedAssets.map((asset) => asset.id)), [selectedAssets]);
  const isAssetSelected = useCallback((assetId) => selectedIds.has(assetId), [selectedIds]);

  const cleanUpAndClose = useCallback(() => {
    setSelectedAssets([]);
    onClosePromiseResolveRef.current = null;
    setAlbumScreenProps(null);
  }, []);

  // openAssetPicker works like the build-in image picker and returns
  // a promise that resolves with the selected assets.
  const openAssetPicker = useCallback(() => {
    return new Promise((resolve) => {
      onClosePromiseResolveRef.current = resolve;
      navigation.navigate('AssetPickerModal');
    });
  }, [navigation]);

  const onConfirmSelection = useCallback(() => {
    onClosePromiseResolveRef.current({ canceled: false, assets: selectedAssets });
    cleanUpAndClose();
  }, [selectedAssets, cleanUpAndClose]);

  const onCancelSelection = useCallback(() => {
    onClosePromiseResolveRef.current({ canceled: true, assets: [] });
    cleanUpAndClose();
  }, [cleanUpAndClose]);

  const toggleSelectAsset = useCallback((asset) => {
    setSelectedAssets((current) =>
      current.some((selected) => selected.id === asset.id)
        ? current.filter((selected) => selected.id !== asset.id)
        : [...current, asset],
    );
  }, []);

  const value = useMemo(
    () => ({
      openAssetPicker,
      toggleSelectAsset,
      selectedAssets,
      setSelectedAssets,
      isAssetSelected,
      albumScreenProps,
      setAlbumScreenProps,
      onConfirmSelection,
      onCancelSelection,
    }),
    [
      openAssetPicker,
      toggleSelectAsset,
      selectedAssets,
      isAssetSelected,
      albumScreenProps,
      onConfirmSelection,
      onCancelSelection,
    ],
  );

  return <AssetPickerContext.Provider value={value}>{children}</AssetPickerContext.Provider>;
}
