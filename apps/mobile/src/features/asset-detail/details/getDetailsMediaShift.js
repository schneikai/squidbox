/**
 * How far the photo moves up when the details panel opens: no further than it takes for the photo,
 * fitted into the page (`width` × `height`, contain), to end above the panel, and centered between
 * the header (`headerBottom`) and the panel when it fits there. Without a known `aspectRatio`
 * (width / height) the photo is taken to fill the page.
 */
export default function getDetailsMediaShift({ width, height, aspectRatio, panelHeight, headerBottom }) {
  const photoHeight = aspectRatio > 0 ? Math.min(height, width / aspectRatio) : height;
  const panelTop = height - panelHeight;
  if (photoHeight > panelTop - headerBottom) return Math.max(0, (height + photoHeight) / 2 - panelTop);
  return Math.max(0, height / 2 - (headerBottom + panelTop) / 2);
}
