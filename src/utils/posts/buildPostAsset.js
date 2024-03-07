import getNewItemId from '@/utils/getNewItemId';

export default function buildPostAsset(asset) {
  return {
    id: getNewItemId(),
    asset,
  };
}
