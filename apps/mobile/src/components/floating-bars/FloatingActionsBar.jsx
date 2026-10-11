import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import { useWindowDimensions } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useFloatingBars } from './FloatingBarsContext';
import SearchOptionsBar from './SearchOptionsBar';

import { spacing } from '@/styles/designTokens';

/**
 * The search + options bar of a main tab screen. `search` is the `searchBar` from useSearchMode.
 */
export default function FloatingActionsBar({ search, placeholder, hasActiveState = false }) {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const { setIsSearchActive, openFilterModal } = useFloatingBars();
  const expandProgress = useSharedValue(0);

  // While this screen is visible, tell the navigation bar whether its search bar is open.
  useFocusEffect(
    useCallback(() => {
      setIsSearchActive(search.isSearchActive);
      return () => setIsSearchActive(false);
    }, [search.isSearchActive, setIsSearchActive]),
  );

  return (
    <SearchOptionsBar
      {...search}
      expandProgress={expandProgress}
      placeholder={placeholder}
      onOpenOptions={openFilterModal}
      hasActiveState={hasActiveState}
      bottom={insets.bottom + spacing.floatingBarBottom}
      left={spacing.floatingBarSide}
      maxWidth={screenWidth - spacing.floatingBarSide * 2}
    />
  );
}
