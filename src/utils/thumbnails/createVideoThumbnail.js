import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { generateThumbnailsAsync } from 'expo-video';

export default async function createVideoThumbnail(videoUri) {
  let resizeParams, thumbnailUri;

  const thumbnails = await generateThumbnailsAsync(videoUri, { times: [0], quality: 1 });
  const videoThumbnail = thumbnails[0];

  try {
    if (videoThumbnail.width > videoThumbnail.height) {
      resizeParams = { width: 1000 };
    } else {
      resizeParams = { height: 1000 };
    }

    thumbnailUri = await ImageManipulator.manipulateAsync(videoThumbnail.uri, [{ resize: resizeParams }], {
      compress: 0.8,
      format: ImageManipulator.SaveFormat.JPEG,
    }).then(({ uri }) => uri);
  } finally {
    await FileSystem.deleteAsync(videoThumbnail.uri, { idempotent: true });
  }

  return thumbnailUri;
}
