import { useNavigation } from '@react-navigation/native';
import { useState, useCallback, useRef } from 'react';

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

  const isAssetSelected = useCallback((asset) => {
    return selectedAssets.find((selectedAsset) => selectedAsset.id === asset.id);
  }, [selectedAssets]);

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
    setSelectedAssets((selectedAssets) => {
      if (isAssetSelected(asset)) {
        return selectedAssets.filter((selectedAsset) => selectedAsset !== asset);
      }
      return [...selectedAssets, asset];
    });
  }, [isAssetSelected]);

  return (
    <AssetPickerContext.Provider
      value={{
        openAssetPicker,
        toggleSelectAsset,
        selectedAssets,
        setSelectedAssets,
        isAssetSelected,
        albumScreenProps,
        setAlbumScreenProps,
        onConfirmSelection,
        onCancelSelection,
      }}
    >
      {children}
    </AssetPickerContext.Provider>
  );
}
