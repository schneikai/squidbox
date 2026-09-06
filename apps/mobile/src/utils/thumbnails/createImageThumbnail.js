import * as ImageManipulator from 'expo-image-manipulator';

import getImageDimensionsAsync from '@/utils/getImageDimensionsAsync';

export default async function createImageThumbnail(imageUri) {
  const { width, height } = await getImageDimensionsAsync(imageUri);
  let resizeParams;

  if (width > height) {
    resizeParams = { width: 1000 };
  } else {
    resizeParams = { height: 1000 };
  }

  const { uri: thumbnailUri } = await ImageManipulator.manipulateAsync(imageUri, [{ resize: resizeParams }], {
    compress: 0.8,
    format: ImageManipulator.SaveFormat.JPEG,
  });

  return thumbnailUri;
}
