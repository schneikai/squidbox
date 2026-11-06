import type { AssetRow } from '@/sync/db/schema';

// An asset's width / height; NaN without an asset, which the zoom and the details cover take as unknown.
export default function aspectRatioOf(asset: Pick<AssetRow, 'width' | 'height'> | undefined): number {
  return asset ? asset.width / asset.height : NaN;
}
