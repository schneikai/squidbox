import { getThumbnail } from "services/ThumbnailService";
import { getFileExtension } from "services/FileService";
import { documentDirectory, moveAsync, deleteAsync, makeDirectoryAsync } from "expo-file-system";
import uuid from "react-native-uuid";

const thumbnailDirectory = "asset-thumbnails/";
const MAX_WIDTH = 2000;
const MAX_HEIGHT = 2000;
const COMPRESSION = 0.6;

// file:///var/mobile/Containers/Data/Application/69DEF245-2E6E-4E90-B039-22761D16840D/Documents/asset-thumbnails/dbc3ea01-ffe5-48d6-a32c-3e349f226fce.jpg
export function thumbnailUriToPath() {
  return "";
}

export function thumbnailPathToUri(path) {
  return documentDirectory + path;
}

export async function getAssetThumbnail(fileUri, mediaType) {
  await makeThumbnailsDocumentDirectory();

  const imageResult = await getThumbnail(fileUri, mediaType, MAX_WIDTH, MAX_HEIGHT, COMPRESSION);
  const thumbnailFilename = `${uuid.v4()}.${getFileExtension(imageResult.uri)}`;
  const thumbnailUri = documentDirectory + thumbnailDirectory + thumbnailFilename;

  try {
    await moveAsync({ from: imageResult.uri, to: thumbnailUri });
    return { ...imageResult, uri: thumbnailUri };
  } catch (err) {
    throw err;
  } finally {
    await deleteAsync(imageResult.uri, { idempotent: true });
  }
}

async function makeThumbnailsDocumentDirectory() {
  makeDirectoryAsync(documentDirectory + thumbnailDirectory, { intermediates: true });
}
