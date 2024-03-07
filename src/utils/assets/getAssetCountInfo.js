import arrayUnique from '@/utils/arrayUnique';
import humanizeMediaType from '@/utils/assets/humanizeMediaType';

export default function getAssetCountInfo(assets) {
  const mediaTypes = arrayUnique(assets.map((asset) => asset.mediaType));

  if (mediaTypes.length === 1) {
    return `${assets.length} ${humanizeMediaType(mediaTypes[0], assets.length)}`;
  }

  return `${assets.length} Assets`;
}
