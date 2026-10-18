/**
 * How the photo, fitted into the page (`width` × `height`, contain), covers the band above the open
 * details panel (the page's top `bandHeight`): the `scale` (around the page's center) at which it
 * fills the band's width and height, cropped, and the `translateY` that centers it in the band.
 * Without a known `aspectRatio` (width / height) the photo is taken to fill the page. A worklet, so
 * each page's style follows the panel's drag on the UI thread.
 */
export default function getDetailsMediaCover({ width, height, aspectRatio, bandHeight }) {
  'worklet';
  const isKnown = aspectRatio > 0;
  const photoWidth = isKnown ? Math.min(width, height * aspectRatio) : width;
  const photoHeight = isKnown ? Math.min(height, width / aspectRatio) : height;
  const scale = photoWidth > 0 && photoHeight > 0 ? Math.max(width / photoWidth, bandHeight / photoHeight) : 1;
  return { scale, translateY: (bandHeight - height) / 2 };
}
