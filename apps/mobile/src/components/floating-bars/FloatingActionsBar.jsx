import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';

import { useFloatingBars } from './FloatingBarsContext';
import SearchSortFilterBar from './SearchSortFilterBar';

/**
 * The search + sort / filter bar of a main tab screen: a SearchSortFilterBar that also tells the
 * navigation bar, while the screen is visible, whether its search field is open.
 */
export default function FloatingActionsBar(props) {
  const { setIsSearchActive } = useFloatingBars();
  const { isSearchActive } = props.search;

  useFocusEffect(
    useCallback(() => {
      setIsSearchActive(isSearchActive);
      return () => setIsSearchActive(false);
    }, [isSearchActive, setIsSearchActive]),
  );

  return <SearchSortFilterBar {...props} />;
}
