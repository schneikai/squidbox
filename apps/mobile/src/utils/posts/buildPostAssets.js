import buildPostAsset from './buildPostAsset';

export default function buildPostAssets(assets) {
  return assets.map((asset) => buildPostAsset(asset));
}
