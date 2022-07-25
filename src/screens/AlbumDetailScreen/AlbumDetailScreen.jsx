import { useState, useLayoutEffect, useEffect } from "react";
import { StyleSheet, SafeAreaView, Text, Pressable, Alert } from "react-native";
import { useAlbum } from "services/AlbumDataService";
import { handleError } from "services/ErrorHandling";
import AlbumActionSheet from "components/AlbumActionSheet";
import { getAlbumAssets } from "services/AlbumAssetDataService";
import AssetList from "components/AssetList";
import buttonStyles from "styles/buttonStyles";
import useAssetSelect from "components/AssetList/useAssetSelect";
import SelectedAssetsToolbar from "components/AssetList/SelectedAssetsToolbar";

export default function AlbumDetailScreen({
  navigation,
  route: {
    params: { album: _album },
  },
}) {
  const [album] = useAlbum(_album.id, _album);
  const [assets, setAssets] = useState([]);
  const { isSelectMode, toggleSelectMode, isAssetSelected, toggleSelectAsset, selectedAssets } = useAssetSelect();

  useEffect(() => {
    getAlbumAssets(album)
      .then((assets) => {
        setAssets(assets);
      })
      .catch((err) => handleError("Failed to load asset!", err));
  }, [album]);

  function onPressAsset(asset) {
    if (!isSelectMode) {
      navigation.navigate("AssetDetail", {
        asset: asset,
        assets: assets,
      });
      return;
    }
    toggleSelectAsset(asset);
  }

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => {
        return (
          <>
            <Pressable onPress={toggleSelectMode} style={buttonStyles.headerButton}>
              <Text style={buttonStyles.headerButtonText}>{isSelectMode ? "Cancel" : "Select"}</Text>
            </Pressable>
            <AlbumActionSheet album={album} />
          </>
        );
      },
    });
  }, [navigation, album, isSelectMode]);

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <AssetList
        assets={assets}
        onPressAsset={onPressAsset}
        isSelectMode={isSelectMode}
        isAssetSelected={isAssetSelected}
      />
      {isSelectMode && (
        <SelectedAssetsToolbar selectedAssets={selectedAssets} toggleSelectMode={toggleSelectMode} album={album} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({});
