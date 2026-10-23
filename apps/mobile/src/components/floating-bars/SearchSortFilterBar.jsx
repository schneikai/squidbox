import { useWindowDimensions } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import SearchOptionsBar from './SearchOptionsBar';
import SortFilterMenu from './SortFilterMenu';

import { layout, sizes } from '@/styles/designTokens';

// The room a list keeps free at its bottom, above the safe-area inset, so its end clears the bar.
export const SEARCH_SORT_FILTER_BAR_CLEARANCE = sizes.iconButton + layout.barBottom * 2 + 16;

/**
 * The bottom-left search + options bar of a screen, with its sort / filter menu (the main tabs
 * use it through FloatingActionsBar). `search` is the `searchBar` from useListControls; pass
 * `expandProgress` to animate a sibling (a segment pill) with the search field. The other props go to
 * SortFilterMenu; the options button lights up while `activeFilter` holds a filter.
 */
export default function SearchSortFilterBar({
  search,
  placeholder,
  expandProgress,
  sortOrder,
  sortOptions,
  activeFilter = [],
  filterOptions,
  onSort,
  onFilter,
  showViewOptions,
}) {
  const { bottom } = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const ownExpandProgress = useSharedValue(0);

  return (
    <SearchOptionsBar
      {...search}
      expandProgress={expandProgress ?? ownExpandProgress}
      optionsMenu={
        <SortFilterMenu
          sortOrder={sortOrder}
          sortOptions={sortOptions}
          activeFilter={activeFilter}
          filterOptions={filterOptions}
          onSort={onSort}
          onFilter={onFilter}
          showViewOptions={showViewOptions}
        />
      }
      hasActiveState={activeFilter.length > 0}
      placeholder={placeholder}
      bottom={bottom + layout.barBottom}
      left={layout.sideGutter}
      maxWidth={screenWidth - layout.sideGutter * 2}
    />
  );
}
