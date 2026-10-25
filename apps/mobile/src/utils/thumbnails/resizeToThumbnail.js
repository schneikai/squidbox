import * as ImageManipulator from 'expo-image-manipulator';

const THUMBNAIL_SIZE = 1000;

/**
 * A JPEG of the image at `uri` whose longer side is THUMBNAIL_SIZE; resolves to `{ uri }`, plus
 * `base64` when asked for.
 */
export default async function resizeToThumbnail(uri, width, height, { base64 = false } = {}) {
  const resize = width > height ? { width: THUMBNAIL_SIZE } : { height: THUMBNAIL_SIZE };
  const result = await ImageManipulator.manipulateAsync(uri, [{ resize }], {
    base64,
    compress: 0.8,
    format: ImageManipulator.SaveFormat.JPEG,
  });

  return { uri: result.uri, base64: result.base64 };
}
