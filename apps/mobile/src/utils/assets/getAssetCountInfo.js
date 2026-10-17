import { MEDIA_TYPES } from '@/utils/assets/constants';
import humanizeMediaType from '@/utils/assets/humanizeMediaType';

/** "3 Photos", "1 Video" or "5 Assets", from counts per media type ({ photo, video }). */
export default function getAssetCountInfo(counts) {
  const total = counts.photo + counts.video;
  if (total === 0) return '0 Assets';
  if (counts.photo === total) return `${total} ${humanizeMediaType(MEDIA_TYPES.IMAGE, total)}`;
  if (counts.video === total) return `${total} ${humanizeMediaType(MEDIA_TYPES.VIDEO, total)}`;
  return `${total} Assets`;
}
