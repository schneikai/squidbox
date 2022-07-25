import { Alert, Linking } from "react-native";
import * as MediaLibrary from "expo-media-library";
import * as FileSystem from "expo-file-system";
import config from "constants/config";
import { fileExists, getFileExtension } from "services/FileService";

// TODO: I couldn't find out how to cancel a download while in progress
export default async function mediaLibraryDownload(asset, onDownloadProgress) {
  let fileUri;
  const hasPermission = await getPermission();

  if (!hasPermission) {
    manualPermissionRequired();
    return;
  }

  if (asset.fileUri && (await fileExists(asset.fileUri))) {
    fileUri = asset.fileUri;
  } else if (asset.fileUrl) {
    fileUri = getDownloadFileUri(asset);
    if (!(await fileExists(fileUri))) {
      await downloadFileFromUrl(asset.fileUrl, fileUri, onDownloadProgress);
    }
  } else {
    throw "File not found!";
  }

  const mediaLibraryAsset = await MediaLibrary.createAssetAsync(fileUri);
  const album = await MediaLibrary.getAlbumAsync(config.mediaLibraryAlbumName);

  if (album) {
    await MediaLibrary.addAssetsToAlbumAsync([mediaLibraryAsset], album, false);
  } else {
    await MediaLibrary.createAlbumAsync(config.mediaLibraryAlbumName, mediaLibraryAsset, false);
  }
}

function getDownloadFileUri(asset) {
  return `${FileSystem.cacheDirectory}${asset.id}.${getFileExtension(asset.filename)}`;
}

async function downloadFileFromUrl(fileUrl, targetUri, onDownloadProgress) {
  const downloadInstance = FileSystem.createDownloadResumable(fileUrl, targetUri, {}, (progress) => {
    const percent = Math.round((progress.totalBytesWritten / progress.totalBytesExpectedToWrite) * 100);
    onDownloadProgress(percent);
  });
  const result = await downloadInstance.downloadAsync();
  return result.uri;
}

async function getPermission() {
  let res = await MediaLibrary.getPermissionsAsync();
  if (!res.granted) {
    res = await MediaLibrary.requestPermissionsAsync();
  }
  return res.granted;
}

function manualPermissionRequired() {
  Alert.alert("Permission required", "Please allow this app access to your photos library.", [
    { text: "YES", onPress: () => Linking.openSettings() },
    { text: "NO" },
  ]);
}
