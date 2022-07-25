import { useState, useEffect } from "react";
import { SafeAreaView, Text } from "react-native";
import * as ExpoMediaLibrary from "expo-media-library";
import to from "await-to-js";
import { handleError } from "services/ErrorHandling";

import Header from "components/MediaLibrary/Header";
import AssetsLibrary from "components/MediaLibrary/AssetsLibrary";
import AlbumsLibrary from "components/MediaLibrary/AlbumsLibrary";
import PermissionRequired from "components/MediaLibrary/PermissionRequired";

export default function MediaLibrary({
  navigation,
  route: {
    params: { callback },
  },
}) {
  const [hasPermission, setHasPermission] = useState(false);
  const [library, setLibrary] = useState("assets");
  const [selectedAssets, setSelectedAssets] = useState([]);

  useEffect(() => {
    getPermission();
  }, []);

  async function getPermission() {
    let err, res;

    [err, res] = await to(ExpoMediaLibrary.getPermissionsAsync());
    if (err) {
      handleError("Failed to get media library permission!", err);
      return;
    }

    if (res.granted) {
      setHasPermission(true);
      return;
    }

    [err, res] = await to(ExpoMediaLibrary.requestPermissionsAsync());
    if (err) {
      handleError("Failed to request media library permission!", err);
      return;
    }

    if (res.granted) {
      setHasPermission(true);
      return;
    }
  }

  function onCancel() {
    navigation.goBack();
  }

  function toggleLibrary() {
    setLibrary((library) => (library === "assets" ? "albums" : "assets"));
  }

  function onSelect() {
    const promises = selectedAssets.map((asset) => ExpoMediaLibrary.getAssetInfoAsync(asset));
    Promise.all(promises).then((assetsWithInfo) => {
      callback(assetsWithInfo);
      navigation.goBack();
    });
  }

  function onSelectAsset(asset) {
    setSelectedAssets((selectedAssets) => {
      if (selectedAssets.some((x) => x.id === asset.id)) {
        return selectedAssets.filter((x) => x.id !== asset.id);
      } else {
        return selectedAssets.concat([asset]);
      }
    });
  }

  function isAssetSelected(asset) {
    return selectedAssets.some((x) => x.id === asset.id);
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <Header library={library} onCancel={onCancel} toggleLibrary={toggleLibrary} onSelect={onSelect} />
      {hasPermission && library === "assets" && (
        <AssetsLibrary onSelectAsset={onSelectAsset} isAssetSelected={isAssetSelected} />
      )}
      {hasPermission && library === "albums" && <AlbumsLibrary />}
      {!hasPermission && <PermissionRequired />}
    </SafeAreaView>
  );
}
