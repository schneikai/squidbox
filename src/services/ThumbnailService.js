import * as VideoThumbnails from "expo-video-thumbnails";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { getImageDimensions } from "services/ImageService";
import { deleteAsync } from "expo-file-system";

export async function getThumbnail(localUri, mediaType, maxWidth, maxHeight, compression) {
  if (mediaType === "video") {
    return await getVideoThumbnail(localUri, maxWidth, maxHeight, compression);
  } else {
    return await getImageThumbnail(localUri, maxWidth, maxHeight, compression);
  }
}

export async function getImageThumbnail(localUri, maxWidth, maxHeight, compression) {
  return await fitImage(localUri, maxWidth, maxHeight, compression);
}

export async function getVideoThumbnail(localUri, maxWidth, maxHeight, compression) {
  const videoThumbnail = await VideoThumbnails.getThumbnailAsync(localUri);

  try {
    return await fitImage(videoThumbnail.uri, maxWidth, maxHeight, compression);
  } catch (err) {
    throw err;
  } finally {
    await deleteAsync(videoThumbnail.uri);
  }
}

// Return ImageResult
// https://docs.expo.dev/versions/latest/sdk/imagemanipulator/#imageresult
// width, height, uri
async function fitImage(localUri, maxWidth, maxHeight, compression) {
  const [srcWidth, srcHeight] = await getImageDimensions(localUri);
  const [newWidth, newHeight] = calculateAspectRatioFit(srcWidth, srcHeight, maxWidth, maxHeight);

  return await manipulateAsync(localUri, [{ resize: { width: newWidth, height: newHeight } }], {
    compress: compression,
    format: SaveFormat.JPEG,
  });
}

function calculateAspectRatioFit(srcWidth, srcHeight, maxWidth, maxHeight) {
  const ratio = Math.min(maxWidth / srcWidth, maxHeight / srcHeight);
  return [srcWidth * ratio, srcHeight * ratio];
}
