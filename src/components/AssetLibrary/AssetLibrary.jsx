import { useEffect, useState } from "react";
import { SafeAreaView, Text } from "react-native";
import Header from "components/AssetLibrary/Header";
import useAssetSelect from "components/AssetList/useAssetSelect";
import { getAllAssets } from "services/AssetDataService";
import AssetList from "components/AssetList";

export default function AssetLibrary({
  navigation,
  route: {
    params: { callback },
  },
}) {
  const [assets, setAssets] = useState([]);
  const { isSelectMode, isAssetSelected, toggleSelectAsset, selectedAssets } = useAssetSelect(true);

  useEffect(() => {
    // TODO: This might need pagination
    getAllAssets()
      .then((assets) => setAssets(assets))
      .catch((err) => handleError("Failed to load assets!", err));
  }, []);

  function onCancel() {
    navigation.goBack();
  }

  function onSelect() {
    callback(selectedAssets);
    navigation.goBack();
  }

  function onPressAsset(asset) {
    toggleSelectAsset(asset);
  }

  return (
    <SafeAreaView>
      <Header onCancel={onCancel} onSelect={onSelect} />
      <AssetList
        assets={assets}
        onPressAsset={onPressAsset}
        isSelectMode={isSelectMode}
        isAssetSelected={isAssetSelected}
      />
    </SafeAreaView>
  );
}
