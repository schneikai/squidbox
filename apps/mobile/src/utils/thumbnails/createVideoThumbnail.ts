import * as VideoThumbnails from 'expo-video-thumbnails';

import resizeToThumbnail from './resizeToThumbnail';

import deletePath from '@/utils/files/deletePath';

export default async function createVideoThumbnail(videoUri: string): Promise<string> {
  const frame = await VideoThumbnails.getThumbnailAsync(videoUri, { time: 0, quality: 1 });

  try {
    return await resizeToThumbnail(frame.uri, frame.width, frame.height);
  } finally {
    deletePath(frame.uri);
  }
}
