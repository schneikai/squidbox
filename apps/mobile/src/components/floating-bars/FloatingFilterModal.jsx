import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useFloatingBars } from './FloatingBarsContext';
import SortFilterModal from './SortFilterModal';

import assetFilterOptions from '@/features/asset-list/actions/filter-assets-action/assetFilterOptions';
import { spacing } from '@/styles/designTokens';

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
      filterOptions={filterModalData?.filterOptions ?? assetFilterOptions}
      onSort={filterModalData?.onSort}
      onFilter={filterModalData?.onFilter}
      showViewOptions={filterModalData?.showViewOptions ?? false}
      bottom={bottom}
      left={spacing.floatingBarSide}
    />
  );
}
