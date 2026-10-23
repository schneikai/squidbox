import resizeToThumbnail from './resizeToThumbnail';

import getImageDimensionsAsync from '@/utils/getImageDimensionsAsync';

export default async function createImageThumbnail(imageUri) {
  const { width, height } = await getImageDimensionsAsync(imageUri);
  return resizeToThumbnail(imageUri, width, height);
}
