import useFilter from '@/hooks/useFilter';
import { MEDIA_TYPES } from '@/utils/assets/constants';

function matchAsset(asset, activeFilter) {
  if (activeFilter.includes('favorites') && !asset.isFavorite) return false;
  if (activeFilter.includes('images') && asset.mediaType !== MEDIA_TYPES.IMAGE) return false;
  if (activeFilter.includes('videos') && asset.mediaType !== MEDIA_TYPES.VIDEO) return false;
  return true;
}

export default function useFilterAssetsAction({ afterFilter } = {}) {
  return useFilter(matchAsset, { afterFilter });
}
