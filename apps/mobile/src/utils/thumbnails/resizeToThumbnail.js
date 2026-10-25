import * as ImageManipulator from 'expo-image-manipulator';

const THUMBNAIL_SIZE = 1000;

/**
 * A JPEG of the image at `uri` whose longer side is `size` (THUMBNAIL_SIZE by default); resolves to
 * `{ uri }`, plus `base64` when asked for.
 */
export default async function resizeToThumbnail(uri, width, height, { size = THUMBNAIL_SIZE, base64 = false } = {}) {
  const resize = width > height ? { width: size } : { height: size };
  const result = await ImageManipulator.manipulateAsync(uri, [{ resize }], {
    base64,
    compress: 0.8,
    format: ImageManipulator.SaveFormat.JPEG,
  });

  return { uri: result.uri, base64: result.base64 };
}
