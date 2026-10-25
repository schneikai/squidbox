import resizeToThumbnail from './resizeToThumbnail';

import getImageDimensionsAsync from '@/utils/getImageDimensionsAsync';

export default async function createImageThumbnail(imageUri) {
  const { width, height } = await getImageDimensionsAsync(imageUri);
  const { uri } = await resizeToThumbnail(imageUri, width, height);
  return uri;
}
