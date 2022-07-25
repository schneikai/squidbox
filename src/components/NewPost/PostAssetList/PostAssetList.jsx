import { StyleSheet, Pressable, View, ScrollView } from "react-native";
import AssetImage from "components/AssetImage";
import { Ionicons } from "@expo/vector-icons";

export default function PostAssetList({ postAssets, removePostAsset, style }) {
  // I'm using ScrollView as a container here so we can disable keyboard dismiss since we want to have it open
  // while creating the new post just like on twitter.
  return (
    <ScrollView
      horizontal={true}
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="always"
      style={style}
    >
      {postAssets.map((postAsset) => (
        <View key={postAsset.id}>
          <Pressable onPress={() => removePostAsset(postAsset)} style={styles.deleteButton}>
            <Ionicons name="ios-close" style={styles.deleteButtonIcon} />
          </Pressable>
          <AssetImage asset={postAsset.asset} style={styles.assetImage} />
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  assetImage: {
    width: 150,
    height: 150,
    marginRight: 10,
  },
  deleteButton: {
    position: "absolute",
    right: 15,
    top: 5,
    zIndex: 1,
    backgroundColor: "black",
    borderRadius: 20,
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteButtonIcon: {
    color: "white",
    fontSize: 13,
  },
});
