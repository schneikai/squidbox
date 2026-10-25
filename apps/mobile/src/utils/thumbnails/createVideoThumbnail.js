import * as FileSystem from 'expo-file-system/legacy';
import * as VideoThumbnails from 'expo-video-thumbnails';

import resizeToThumbnail from './resizeToThumbnail';

export default async function createVideoThumbnail(videoUri) {
  const frame = await VideoThumbnails.getThumbnailAsync(videoUri, { time: 0, quality: 1 });

  try {
    const { uri } = await resizeToThumbnail(frame.uri, frame.width, frame.height);
    return uri;
  } finally {
    await FileSystem.deleteAsync(frame.uri, { idempotent: true });
  }
}
