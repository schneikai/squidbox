import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useFloatingBars } from './FloatingBarsContext';
import SortFilterModal from './SortFilterModal';

import { spacing } from '@/styles/designTokens';

const DEFAULT_FILTER_OPTIONS = [
  { key: 'all', label: 'All Media', icon: 'apps-outline' },
  { key: 'favorites', label: 'Favorites', icon: 'heart-outline' },
  { key: 'images', label: 'Photos', icon: 'image-outline' },
  { key: 'videos', label: 'Videos', icon: 'videocam-outline' },
];

export default function FloatingFilterModal() {
  const insets = useSafeAreaInsets();
  const { isFilterModalOpen, closeFilterModal, filterModalData } = useFloatingBars();

  const bottom = insets.bottom + spacing.floatingBarBottom + spacing.iconButtonSize + spacing.popoverGap;

  return (
    <SortFilterModal
      visible={isFilterModalOpen}
      onClose={closeFilterModal}
      sortOrder={filterModalData?.sortOrder ?? 'createdAt:desc'}
      sortOptions={filterModalData?.sortOptions}
      activeFilter={filterModalData?.activeFilter ?? []}
      filterOptions={filterModalData?.filterOptions ?? DEFAULT_FILTER_OPTIONS}
      onSort={filterModalData?.onSort}
      onFilter={filterModalData?.onFilter}
      showViewOptions={filterModalData?.showViewOptions ?? false}
      bottom={bottom}
      left={spacing.floatingBarSide}
    />
  );
}
