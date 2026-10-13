import { useNavigationState } from '@react-navigation/native';
import { useState, useRef, useCallback, useMemo } from 'react';
import { useSharedValue } from 'react-native-reanimated';

import FloatingBarsContext from './FloatingBarsContext';
import { getActiveTabName } from './navStateHelpers';

import useToggleSelectAssetsAction from '@/features/asset-list/actions/toggle-select-assets-action/useToggleSelectAssetsAction';

const TAB_TO_OPTIONS_KEY = {
  AssetsTab: 'assets',
  AlbumsTab: 'albums',
  PostsTab: 'posts',
};

export default function FloatingBarsProvider({ children }) {
  // ── Search ────────────────────────────────────────────────────────────────
  // Each main screen owns its search (see useSearchMode). The visible one reports whether its search
  // bar is open, so the navigation bar can make room for it.
  const [isSearchActive, setIsSearchActive] = useState(false);

  // ── Filter modal ──────────────────────────────────────────────────────────
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  // Snapshot of the active screen's options captured when the modal opens,
  // so the modal doesn't need live reactive state.
  const [filterModalData, setFilterModalData] = useState(null);

  // ── Per-screen options (ref = no extra re-renders on every sort/filter change)
  const screenOptionsRef = useRef({});

  const registerScreenOptions = useCallback((tab, options) => {
    screenOptionsRef.current[tab] = options;
  }, []);

  const activeTabName = useNavigationState(getActiveTabName);

  const openFilterModal = useCallback(() => {
    const key = TAB_TO_OPTIONS_KEY[activeTabName] ?? 'assets';
    setFilterModalData({ ...screenOptionsRef.current[key] });
    setIsFilterModalOpen(true);
  }, [activeTabName]);

  const closeFilterModal = useCallback(() => setIsFilterModalOpen(false), []);

  // ── Select mode (assets screen only) ─────────────────────────────────────
  const selection = useToggleSelectAssetsAction();

  // ── Scroll-driven visibility (Reanimated shared values) ───────────────────
  const scrollY = useSharedValue(0);
  const isNavBarHidden = useSharedValue(0); // 0 = visible, 1 = hidden

  const resetScroll = useCallback(() => {
    scrollY.value = 0;
    isNavBarHidden.value = 0;
  }, [scrollY, isNavBarHidden]);

  // Memoized: the provider sits above the screens and re-renders with navigation and app-level
  // updates, which must not re-render every screen that uses the floating bars.
  const value = useMemo(
    () => ({
      // Search
      isSearchActive,
      setIsSearchActive,

      // Filter modal
      isFilterModalOpen,
      filterModalData,
      openFilterModal,
      closeFilterModal,

      // Screen options registration
      registerScreenOptions,
      screenOptionsRef,

      // Select mode
      ...selection,

      // Scroll animation values (passed to animated components)
      scrollY,
      isNavBarHidden,
      resetScroll,
    }),
    [
      isSearchActive,
      isFilterModalOpen,
      filterModalData,
      openFilterModal,
      closeFilterModal,
      registerScreenOptions,
      selection,
      scrollY,
      isNavBarHidden,
      resetScroll,
    ],
  );

  return <FloatingBarsContext value={value}>{children}</FloatingBarsContext>;
}
