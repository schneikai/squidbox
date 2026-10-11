import { useIsFocused } from '@react-navigation/native';
import { useWindowDimensions } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useFloatingBars } from './FloatingBarsContext';
import SearchOptionsBar from './SearchOptionsBar';

import { spacing } from '@/styles/designTokens';

export default function FloatingActionsBar({ hasActiveState = false }) {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const { isSearchActive, searchText, openSearch, closeSearch, setSearchText, openFilterModal } = useFloatingBars();

  const isFocused = useIsFocused();
  const expandProgress = useSharedValue(0);

  return (
    <SearchOptionsBar
      expandProgress={expandProgress}
      // Search state is shared by all main tabs, but only the visible tab's bar may open and focus
      // its input. A hidden tab's focused input pops the keyboard up when that tab is shown again.
      isSearchActive={isSearchActive && isFocused}
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
