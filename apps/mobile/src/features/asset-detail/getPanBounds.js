/**
 * How far a zoomed image may move from the center on each axis before an edge comes into view. The
 * image is fitted (`contain`) into the `width` × `height` view; an axis it doesn't overflow can't move.
 * Without a usable `aspectRatio` the image is taken to fill the view; an unmeasured view can't pan.
 */
export default function getPanBounds({ scale, width, height, aspectRatio }) {
  'worklet';
  if (!(width > 0 && height > 0 && scale > 0)) return { x: 0, y: 0 };
  const viewRatio = width / height;
  const ratio = aspectRatio > 0 && Number.isFinite(aspectRatio) ? aspectRatio : viewRatio;
  const isWider = ratio > viewRatio;
  const fittedWidth = isWider ? width : height * ratio;
  const fittedHeight = isWider ? width / ratio : height;
  return {
    x: Math.max(0, (fittedWidth * scale - width) / 2),
    y: Math.max(0, (fittedHeight * scale - height) / 2),
  };
}
