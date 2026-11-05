import { useWindowDimensions } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import SearchOptionsBar from './SearchOptionsBar';
import SortFilterMenu from './SortFilterMenu';

import { layout } from '@/styles/designTokens';

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
      bottom={bottom + layout.barMargin}
      left={layout.sideGutter}
      maxWidth={screenWidth - layout.sideGutter * 2}
    />
  );
}
