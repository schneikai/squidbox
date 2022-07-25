import { View, Text, StyleSheet, Pressable, Alert } from "react-native";
import { AntDesign } from "@expo/vector-icons";
import { markAssetDeleted } from "services/AssetDataService";
import to from "await-to-js";
import { handleError } from "services/ErrorHandling";
import { removeAssetsFromAlbum } from "services/AlbumAssetDataService";
import { useActionSheet } from "@expo/react-native-action-sheet";
import { openAlbumLibrary } from "components/AlbumLibrary";
import { useNavigation } from "@react-navigation/native";
import { addAssetsToAlbum } from "services/AlbumAssetDataService";
import { useBlockingProgress } from "components/BlockingProgress";
import mediaLibraryDownload from "services/MediaLibraryDownload";
import { newPostAsset } from "services/PostAssetDataService";
import { newPostData } from "services/PostDataService";

export default function SelectedAssetsToolbar({ selectedAssets, toggleSelectMode, album }) {
  const navigation = useNavigation();
  const { showActionSheetWithOptions } = useActionSheet();
  const BlockingProgress = useBlockingProgress();

  function confirmDeleteAssets() {
    if (album) {
      confirmDeleteAlbumAssets();
      return;
    }

    const options = [`Delete ${selectedAssets.length} assets`, "Cancel"];

    showActionSheetWithOptions(
      {
        options,
        cancelButtonIndex: options.length - 1,
        destructiveButtonIndex: 0,
      },
      (buttonIndex) => {
        switch (buttonIndex) {
          case 0:
            deleteAssets();
            toggleSelectMode();
            break;
        }
      }
    );
  }

  function confirmDeleteAlbumAssets() {
    const options = ["Remove from album", "Delete", "Cancel"];

    showActionSheetWithOptions(
      {
        options,
        cancelButtonIndex: options.length - 1,
        destructiveButtonIndex: 1,
      },
      (buttonIndex) => {
        switch (buttonIndex) {
          case 0:
            removeAlbumAssets();
            toggleSelectMode();
            break;
          case 1:
            removeAlbumAssets();
            deleteAssets();
            toggleSelectMode();
            break;
        }
      }
    );
  }

  async function deleteAssets() {
    const promises = selectedAssets.map((asset) => markAssetDeleted(asset.id));
    const [err] = await to(Promise.all(promises));
    if (err) {
      handleError("Failed to delete assets!", err);
    }
  }

  async function removeAlbumAssets() {
    const [err] = await to(removeAssetsFromAlbum(album.id, selectedAssets));
    if (err) {
      handleError("Failed to remove assets from album!", err);
    }
  }

  function withSelectedAssets() {
    const options = ["Add to album", "Create Post", "Download", "Cancel"];

    showActionSheetWithOptions(
      {
        options,
        cancelButtonIndex: options.length - 1,
      },
      (buttonIndex) => {
        switch (buttonIndex) {
          case 0:
            addToAlbum();
            break;
          case 1:
            createPost();
            break;
          case 2:
            confirmDownload();
            break;
        }
      }
    );
  }

  function createPost() {
    const postData = newPostData();
    postData.postAssets = selectedAssets.map((asset) => newPostAsset(asset));
    navigation.navigate("NewPost", { postData, back: "PostIndex" });
    toggleSelectMode();
  }

  async function addToAlbum() {
    const [err, album] = await to(openAlbumLibrary(navigation));
    if (err) {
      handleError("Failed to open album library!", err);
    }

    const [errAddAssets] = await to(addAssetsToAlbum(album.id, selectedAssets));
    if (errAddAssets) {
      handleError("Failed to add asset to album!", errAddAssets);
    }

    toggleSelectMode();
  }

  function confirmDownload() {
    Alert.alert(`Download ${selectedAssets.length} files?`, null, [
      { text: "OK", onPress: download },
      {
        text: "Cancel",
      },
    ]);
  }

  async function download() {
    BlockingProgress.show();

    try {
      for (const asset of selectedAssets) {
        await mediaLibraryDownload(asset, BlockingProgress.updateProgress);
      }
      toggleSelectMode();
    } catch (err) {
      handleError("Failed to download file!", err);
    } finally {
      BlockingProgress.hide();
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        <Pressable style={styles.button} onPress={withSelectedAssets}>
          <AntDesign name="upload" size={24} color="black" />
        </Pressable>
        <Text style={styles.toolbarLabel}>{selectedAssets.length} selected</Text>
        <Pressable style={styles.button} onPress={confirmDeleteAssets}>
          <AntDesign name="delete" size={24} color="black" />
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
    alignItems: "center",
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
  toolbarLabel: {
    fontWeight: "500",
  },
});
