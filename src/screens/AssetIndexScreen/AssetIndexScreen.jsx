import { useLayoutEffect } from "react";
import { SafeAreaView, Pressable, Text } from "react-native";
import { handleError } from "services/ErrorHandling";
import to from "await-to-js";
import AssetList from "components/AssetList";
import { useAssets } from "services/AssetDataService";
import buttonStyles from "styles/buttonStyles";
import { addAssetsFromMediaLibrary } from "components/MediaLibrary";
import SelectedAssetsToolbar from "components/AssetList/SelectedAssetsToolbar";
import useAssetSelect from "components/AssetList/useAssetSelect";

export default function AssetIndexScreen({ route, navigation }) {
  // TODO: This must use pagination!
  const [assets] = useAssets();
  const { isSelectMode, toggleSelectMode, isAssetSelected, toggleSelectAsset, selectedAssets } = useAssetSelect();

  async function addAsset() {
    const [err] = await to(addAssetsFromMediaLibrary(navigation));
    if (err) {
      handleError("Failed to add asset!", err);
    }
  }

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
            <Pressable onPress={addAsset} style={buttonStyles.headerButton}>
              <Text style={buttonStyles.headerButtonText}>+</Text>
            </Pressable>
          </>
        );
      },
    });
  }, [navigation, isSelectMode]);

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <AssetList
        assets={assets}
        onPressAsset={onPressAsset}
        isSelectMode={isSelectMode}
        isAssetSelected={isAssetSelected}
      />
      {isSelectMode && <SelectedAssetsToolbar selectedAssets={selectedAssets} toggleSelectMode={toggleSelectMode} />}
    </SafeAreaView>
  );
}
