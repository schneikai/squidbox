import { useWindowDimensions } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useFloatingBars } from './FloatingBarsContext';
import SearchOptionsBar from './SearchOptionsBar';
import { spacing } from '@/styles/designTokens';

export default function FloatingActionsBar({ hasActiveState = false }) {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const {
    isSearchActive,
    searchText,
    openSearch,
    closeSearch,
    setSearchText,
    openFilterModal,
  } = useFloatingBars();

  const expandProgress = useSharedValue(0);

  return (
    <SearchOptionsBar
      expandProgress={expandProgress}
      isSearchActive={isSearchActive}
      searchText={searchText}
      onOpenSearch={openSearch}
      onCloseSearch={closeSearch}
      onChangeSearch={setSearchText}
      onOpenOptions={openFilterModal}
      hasActiveState={hasActiveState}
      bottom={insets.bottom + spacing.floatingBarBottom}
      left={spacing.floatingBarSide}
      maxWidth={screenWidth - spacing.floatingBarSide * 2}
    />
  );
}
