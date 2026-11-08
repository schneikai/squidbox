import { useWindowDimensions } from 'react-native';
import { type SharedValue, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import SearchOptionsBar, { type SearchBarState } from './SearchOptionsBar';
import SortFilterMenu, { type SortFilterMenuProps, type SortOption } from './SortFilterMenu';

import { layout } from '@/styles/designTokens';

export type SearchSortFilterBarProps<Sort extends string, Filter extends string = string> = {
  search: SearchBarState;
  placeholder?: string;
  expandProgress?: SharedValue<number>;
  sortOptions?: SortOption<Sort>[];
} & Omit<SortFilterMenuProps<Sort, Filter>, 'sortOptions'>;

/**
 * The bottom-left search + options bar of a screen, with its sort / filter menu (the main tabs
 * use it through FloatingActionsBar). `search` is the `searchBar` from useListControls; pass
 * `expandProgress` to animate a sibling (a segment pill) with the search field. The other props go to
 * SortFilterMenu; the options button lights up while `activeFilter` holds a filter. Without sort,
 * filter or view options the bar is search only.
 */
export default function SearchSortFilterBar<Sort extends string, Filter extends string = string>({
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
}: SearchSortFilterBarProps<Sort, Filter>) {
  const { bottom } = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const ownExpandProgress = useSharedValue(0);
  const hasOptions = !!sortOptions?.length || !!filterOptions?.length || !!showViewOptions;

  return (
    <SearchOptionsBar
      {...search}
      expandProgress={expandProgress ?? ownExpandProgress}
      optionsMenu={
        hasOptions && (
          <SortFilterMenu
            sortOrder={sortOrder}
            sortOptions={sortOptions ?? []}
            activeFilter={activeFilter}
            filterOptions={filterOptions}
            onSort={onSort}
            onFilter={onFilter}
            showViewOptions={showViewOptions}
          />
        )
      }
      hasActiveState={activeFilter.length > 0}
      placeholder={placeholder}
      bottom={bottom + layout.barMargin}
      left={layout.sideGutter}
      maxWidth={screenWidth - layout.sideGutter * 2}
    />
  );
}
