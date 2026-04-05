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
    tabHasActiveOptions,
  } = useFloatingBars();

  const expandProgress = useSharedValue(0);

  const activeTab = useNavigationState((s) => getActiveTabName(s));
  const stackDepth = useNavigationState((s) => getActiveStackDepth(s));
  const isMainScreen = MAIN_TABS.includes(activeTab) && stackDepth === 0;

  const TAB_KEY = { AssetsTab: 'assets', AlbumsTab: 'albums', PostsTab: 'posts' };
  const hasActiveState = tabHasActiveOptions[TAB_KEY[activeTab]] ?? false;

  if (!isMainScreen) return null;

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
