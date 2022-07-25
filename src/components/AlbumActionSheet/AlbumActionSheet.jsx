import { Text, Pressable, Alert } from "react-native";
import { useActionSheet } from "@expo/react-native-action-sheet";
import buttonStyles from "styles/buttonStyles";
import { updateAlbum, markAlbumDeleted } from "services/AlbumDataService";
import { handleError } from "services/ErrorHandling";
import to from "await-to-js";
import { addAssetsFromMediaLibrary } from "components/MediaLibrary";
import { openAssetLibrary } from "components/AssetLibrary";
import { addAssetsToAlbum } from "services/AlbumAssetDataService";
import { useNavigation } from "@react-navigation/native";

export default function AlbumActionSheet({ album }) {
  const navigation = useNavigation();
  const { showActionSheetWithOptions } = useActionSheet();

  function showActionSheet() {
    const options = ["Add Assets", "Rename Album", "Delete Album", "Cancel"];

    showActionSheetWithOptions(
      {
        options,
        cancelButtonIndex: options.length - 1,
        destructiveButtonIndex: 2,
      },
      (buttonIndex) => {
        switch (buttonIndex) {
          case 0:
            addAssets();
            break;
          case 1:
            renameAlbum();
            break;
          case 2:
            if (isEmptyAlbum()) {
              confirmDeleteAlbum();
            } else {
              deleteAlbum();
            }
            break;
        }
      }
    );
  }

  function addAssets() {
    const options = ["From Library", "From Device", "Cancel"];

    showActionSheetWithOptions(
      {
        options,
        cancelButtonIndex: options.length - 1,
      },
      (buttonIndex) => {
        switch (buttonIndex) {
          case 0:
            addAssetsFromLibrary();
            break;
          case 1:
            addAssetsFromDevice();
            break;
        }
      }
    );
  }

  async function addAssetsFromLibrary() {
    const [err, assets] = await to(openAssetLibrary(navigation));
    if (err) {
      handleError("Failed to open asset library!", err);
    }

    const [errAddAssets] = await to(addAssetsToAlbum(album.id, assets));
    if (errAddAssets) {
      handleError("Failed to add asset to album!", err);
    }
  }

  async function addAssetsFromDevice() {
    const [err, assets] = await to(addAssetsFromMediaLibrary(navigation));
    if (err) {
      handleError("Failed to add asset!", err);
    }

    const [errAddAssets] = await to(addAssetsToAlbum(album.id, assets));
    if (errAddAssets) {
      handleError("Failed to add asset to album!", err);
    }
  }

  function renameAlbum() {
    Alert.prompt(
      "Album name",
      undefined,
      (name) => {
        saveRenameAlbum(name);
      },
      "plain-text",
      album.name
    );
  }

  async function saveRenameAlbum(name) {
    const [err] = await to(updateAlbum(album.id, { name: name }));
    if (err) {
      handleError("Failed to rename album!", err);
      return;
    }
  }

  function isEmptyAlbum() {
    return album.assets && album.assets.length ? "true" : false;
  }

  function confirmDeleteAlbum() {
    const options = ["Delete album keep files", "Delete album and files", "Cancel"];

    showActionSheetWithOptions(
      {
        options,
        cancelButtonIndex: options.length - 1,
      },
      (buttonIndex) => {
        switch (buttonIndex) {
          case 0:
            deleteAlbum();
            break;
          case 1:
            deleteAlbumAndAssets();
            break;
        }
      }
    );
  }

  async function deleteAlbum() {
    const [err] = await to(markAlbumDeleted(album.id));
    if (err) {
      handleError("Failed to delete album!", err);
      return;
    }
    navigation.navigate("AlbumIndex");
  }

  function deleteAlbumAndAssets() {
    Alert.alert("TODO", "deleteAlbumAndAssets");
  }

  return (
    <Pressable onPress={showActionSheet} style={buttonStyles.headerButton}>
      <Text style={buttonStyles.headerButtonText}>...</Text>
    </Pressable>
  );
}
