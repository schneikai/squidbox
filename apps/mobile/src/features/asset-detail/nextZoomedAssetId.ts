// A page that zooms out clears the slot only if it still holds that page.
export default function nextZoomedAssetId({
  zoomed,
  assetId,
  isZoomed,
}: {
  zoomed: string | null;
  assetId: string;
  isZoomed: boolean;
}): string | null {
  if (isZoomed) return assetId;
  return zoomed === assetId ? null : zoomed;
}
