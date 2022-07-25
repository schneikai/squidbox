import { getThumbnail } from "services/ThumbnailService";
import { getFileExtension } from "services/FileService";
import { documentDirectory, moveAsync, deleteAsync, makeDirectoryAsync } from "expo-file-system";
import uuid from "react-native-uuid";

const thumbnailDirectory = `${documentDirectory}asset-thumbnails`;
const MAX_WIDTH = 2000;
const MAX_HEIGHT = 2000;
const COMPRESSION = 0.6;

export async function getAssetThumbnail(fileUri, mediaType) {
  await makeThumbnailsDocumentDirectory();

  const imageResult = await getThumbnail(fileUri, mediaType, MAX_WIDTH, MAX_HEIGHT, COMPRESSION);
  const thumbnailFilename = `${uuid.v4()}.${getFileExtension(imageResult.uri)}`;
  const thumbnailUri = `${thumbnailDirectory}/${thumbnailFilename}`;

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
  makeDirectoryAsync(thumbnailDirectory, { intermediates: true });
}
