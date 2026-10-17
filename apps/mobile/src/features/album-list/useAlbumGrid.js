import { useWindowDimensions } from 'react-native';

import { SCREEN_PADDING } from '@/constants';

const NUM_COLUMNS = 2;

/**
 * The album grid's `numColumns`, `gap` and `itemWidth`, shared by AlbumList and SortableAlbumList so
 * they can't drift. Side insets and the gap between columns are SCREEN_PADDING, so the grid lines up
 * with the posts list (which pads each item by SCREEN_PADDING).
 */
export default function useAlbumGrid() {
  const window = useWindowDimensions();
  const gap = SCREEN_PADDING;
  return { numColumns: NUM_COLUMNS, gap, itemWidth: (window.width - gap * (NUM_COLUMNS + 1)) / NUM_COLUMNS };
}
