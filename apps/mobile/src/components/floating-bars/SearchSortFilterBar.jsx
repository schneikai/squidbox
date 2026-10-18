import { useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import SearchOptionsBar from './SearchOptionsBar';
import SortFilterModal from './SortFilterModal';

import { spacing } from '@/styles/designTokens';

// The room a list keeps free at its bottom, above the safe-area inset, so its end clears the bar.
export const SEARCH_SORT_FILTER_BAR_CLEARANCE = spacing.iconButtonSize + spacing.floatingBarBottom * 2 + 16;

/**
 * The bottom-left search + options bar of a screen outside the main tabs, with its own sort / filter
 * popover. `search` is the `searchBar` from useSearchMode; pass `expandProgress` to animate a sibling
 * (a segment pill) with the search field. The other props go to SortFilterModal.
 */
export default function SearchSortFilterBar({
  search,
  placeholder,
  hasActiveState,
  expandProgress,
  sortOrder,
  sortOptions,
  activeFilter,
  filterOptions,
  onSort,
  onFilter,
  showViewOptions,
}) {
  const { bottom } = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const ownExpandProgress = useSharedValue(0);
  const [isSortFilterOpen, setIsSortFilterOpen] = useState(false);

  const barBottom = bottom + spacing.floatingBarBottom;

  return (
    <>
      <SearchOptionsBar
        {...search}
        expandProgress={expandProgress ?? ownExpandProgress}
        onOpenOptions={() => setIsSortFilterOpen(true)}
        hasActiveState={hasActiveState}
        placeholder={placeholder}
        bottom={barBottom}
        left={spacing.floatingBarSide}
        maxWidth={screenWidth - spacing.floatingBarSide * 2}
      />
      <SortFilterModal
        visible={isSortFilterOpen}
        onClose={() => setIsSortFilterOpen(false)}
        sortOrder={sortOrder}
        sortOptions={sortOptions}
        activeFilter={activeFilter}
        filterOptions={filterOptions}
        onSort={onSort}
        onFilter={onFilter}
        showViewOptions={showViewOptions}
        bottom={barBottom + spacing.iconButtonSize + spacing.popoverGap}
        left={spacing.floatingBarSide}
      />
    </>
  );
}
