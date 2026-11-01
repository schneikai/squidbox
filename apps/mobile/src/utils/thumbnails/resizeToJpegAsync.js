import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

/**
 * A JPEG (`quality` 0 to 1) of the image at `uri`, `width` × `height`, whose longer side is `longSide`:
 * `{ uri, base64 }`, with base64 only when `base64` is set.
 */
export default async function resizeToJpegAsync(uri, { width, height, longSide, quality = 0.8, base64 = false }) {
  const resize = width > height ? { width: longSide } : { height: longSide };
  const context = ImageManipulator.manipulate(uri).resize(resize);
  try {
    const image = await context.renderAsync();
    try {
      return await image.saveAsync({ compress: quality, format: SaveFormat.JPEG, base64 });
    } finally {
      image.release();
    }
  } finally {
    context.release();
  }
}
