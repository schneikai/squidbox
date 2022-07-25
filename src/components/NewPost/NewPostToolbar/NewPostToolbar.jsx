import { useEffect, useState } from "react";
import { StyleSheet, Pressable, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getAllAssets } from "services/AssetDataService";
import AssetImage from "components/AssetImage";
import { openAssetLibrary } from "components/AssetLibrary";
import { handleError } from "services/ErrorHandling";
import to from "await-to-js";
import { useNavigation } from "@react-navigation/native";

export default function NewPostToolbar({ addAssets, style }) {
  const navigation = useNavigation();
  const [assets, setAssets] = useState([]);

  useEffect(() => {
    getAllAssets(20)
      .then((assets) => setAssets(assets))
      .catch((err) => handleError("Failed to load assets!", err));
  }, []);

  async function openLibrary() {
    const [err, assets] = await to(openAssetLibrary(navigation));
    if (err) {
      handleError("Failed to open asset library!", err);
    }

    addAssets(assets);
  }

  // I'm using ScrollView as a container here so we can disable keyboard dismiss since we want to have it open
  // while creating the new post just like on twitter.
  return (
    <ScrollView
      horizontal={true}
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="always"
      style={[style, styles.container]}
    >
      <Pressable onPress={openLibrary} style={[styles.itemBase, styles.button]}>
        <Ionicons name="images-outline" style={styles.buttonIcon} />
      </Pressable>
      {assets.map((asset) => (
        <Pressable key={asset.id} style={[styles.itemBase, styles.asset]} onPress={() => addAssets([asset])}>
          <AssetImage asset={asset} style={styles.assetImage} />
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  itemBase: {
    height: "100%",
    aspectRatio: 1,
    borderRadius: 10,
    overflow: "hidden",
    height: 70,
    marginRight: 10,
  },
  button: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "lightgrey",
  },
  buttonIcon: {
    fontSize: 24,
    color: "grey",
  },
  asset: {},
  assetImage: {
    width: "100%",
    height: "100%",
  },
});
