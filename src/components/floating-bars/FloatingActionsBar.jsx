import { useWindowDimensions } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigationState } from '@react-navigation/native';

import { useFloatingBars } from './FloatingBarsContext';
import { MAIN_TABS, getActiveTabName, getActiveStackDepth } from './navStateHelpers';
import SearchOptionsBar from './SearchOptionsBar';
import { spacing } from '@/styles/designTokens';

export default function FloatingActionsBar() {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const {
    isSearchActive,
    searchText,
    openSearch,
    closeSearch,
    setSearchText,
    openFilterModal,
    isSelectMode,
  } = useFloatingBars();

  // expandProgress is owned here so FloatingHeader can potentially react to it in the future.
  // hasActiveState is not shown on the main screen bar because screenOptionsRef is a ref
  // (not reactive state), so it can't trigger re-renders. The album detail has local state
  // and can properly derive this value.
  const expandProgress = useSharedValue(0);

  const activeTab = useNavigationState((s) => getActiveTabName(s));
  const stackDepth = useNavigationState((s) => getActiveStackDepth(s));
  const isMainScreen = MAIN_TABS.includes(activeTab) && stackDepth === 0;

  if (!isMainScreen || isSelectMode) return null;

  return (
    <SearchOptionsBar
      expandProgress={expandProgress}
      isSearchActive={isSearchActive}
      searchText={searchText}
      onOpenSearch={openSearch}
      onCloseSearch={closeSearch}
      onChangeSearch={setSearchText}
      onOpenOptions={openFilterModal}
      hasActiveState={false}
      bottom={insets.bottom + spacing.floatingBarBottom}
      left={spacing.floatingBarSide}
      maxWidth={screenWidth - spacing.floatingBarSide * 2}
    />
  );
}
