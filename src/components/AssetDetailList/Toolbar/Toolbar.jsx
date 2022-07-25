import { View, StyleSheet, Pressable } from "react-native";
import { AntDesign, Feather } from "@expo/vector-icons";
import { useActionSheet } from "@expo/react-native-action-sheet";

export default function Toolbar({
  asset,
  onToggleAssetFavorite,
  onDownloadAsset,
  onDeleteAsset,
  onAddToAlbum,
  onCreatePost,
}) {
  const { showActionSheetWithOptions } = useActionSheet();

  function showMoreActionSheet(asset) {
    const options = ["Add to album", "Create post", "Cancel"];

    showActionSheetWithOptions(
      {
        options,
        cancelButtonIndex: options.length - 1,
      },
      (buttonIndex) => {
        switch (buttonIndex) {
          case 0:
            onAddToAlbum(asset);
            break;
          case 1:
            onCreatePost(asset);
            break;
        }
      }
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        <Pressable style={styles.button} onPress={() => asset && onToggleAssetFavorite(asset)}>
          {asset && asset.isFavorite ? (
            <AntDesign name="heart" size={24} color="black" />
          ) : (
            <AntDesign name="hearto" size={24} color="black" />
          )}
        </Pressable>
        <Pressable style={styles.button} onPress={() => asset && onDownloadAsset(asset)}>
          <AntDesign name="download" size={24} color="black" />
        </Pressable>
        <Pressable style={styles.button} onPress={() => asset && showMoreActionSheet(asset)}>
          <Feather name="more-horizontal" size={24} color="black" />
        </Pressable>
        <Pressable style={styles.button} onPress={() => asset && onDeleteAsset(asset)}>
          <AntDesign name="delete" size={24} color="crimson" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  toolbar: {
    width: "80%",
    backgroundColor: "#fff",
    flexDirection: "row",
    borderRadius: 10,
    justifyContent: "space-around",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,

    elevation: 5,
  },
  button: {
    padding: 15,
  },
});
