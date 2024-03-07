import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import * as VideoThumbnails from 'expo-video-thumbnails';

export default async function createVideoThumbnail(videoUri) {
  let resizeParams, thumbnailUri;

  const videoThumbnail = await VideoThumbnails.getThumbnailAsync(videoUri, {
    time: 0,
    quality: 1,
  });

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
