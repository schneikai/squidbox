import * as ImageManipulator from 'expo-image-manipulator';

const THUMBNAIL_SIZE = 1000;

// A JPEG of the image at `uri` whose longer side is THUMBNAIL_SIZE; resolves to its uri.
export default async function resizeToThumbnail(uri, width, height) {
  const resize = width > height ? { width: THUMBNAIL_SIZE } : { height: THUMBNAIL_SIZE };
  const { uri: thumbnailUri } = await ImageManipulator.manipulateAsync(uri, [{ resize }], {
    compress: 0.8,
    format: ImageManipulator.SaveFormat.JPEG,
  });

  return thumbnailUri;
}
