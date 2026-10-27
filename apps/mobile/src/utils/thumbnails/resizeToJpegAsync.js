import * as ImageManipulator from 'expo-image-manipulator';

/**
 * A JPEG (`quality` 0 to 1) of the image at `uri`, `width` × `height`, whose longer side is `longSide`:
 * `{ uri, base64 }`, with base64 only when `base64` is set.
 */
export default async function resizeToJpegAsync(uri, { width, height, longSide, quality = 0.8, base64 = false }) {
  const resize = width > height ? { width: longSide } : { height: longSide };
  return ImageManipulator.manipulateAsync(uri, [{ resize }], {
    compress: quality,
    format: ImageManipulator.SaveFormat.JPEG,
    base64,
  });
}
