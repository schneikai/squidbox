import { useState, useRef, useCallback } from 'react';
import { useNavigationState } from '@react-navigation/native';
import { useSharedValue, withSpring } from 'react-native-reanimated';

import FloatingBarsContext from './FloatingBarsContext';
import { getActiveTabName } from './navStateHelpers';

const TAB_TO_OPTIONS_KEY = {
  AssetsTab: 'assets',
  AlbumsTab: 'albums',
  PostsTab: 'posts',
};

export default function FloatingBarsProvider({ children }) {
  // ── Search ────────────────────────────────────────────────────────────────
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchText, setSearchTextState] = useState('');

  function openSearch() {
    setIsSearchActive(true);
  }

  function closeSearch() {
    setIsSearchActive(false);
    setSearchTextState('');
  }

  function setSearchText(text) {
    setSearchTextState(text);
  }

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

  function openFilterModal() {
    const key = TAB_TO_OPTIONS_KEY[activeTabName] ?? 'assets';
    setFilterModalData({ ...screenOptionsRef.current[key] });
    setIsFilterModalOpen(true);
  }

  function closeFilterModal() {
    setIsFilterModalOpen(false);
  }

  // ── Select mode (assets screen only) ─────────────────────────────────────
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedAssetIds, setSelectedAssetIds] = useState([]);

  function toggleSelectMode() {
    setIsSelectMode((prev) => {
      if (prev) setSelectedAssetIds([]);
      return !prev;
    });
  }

  function exitSelectMode() {
    setIsSelectMode(false);
    setSelectedAssetIds([]);
  }

  function toggleSelectAsset(assetId) {
    setSelectedAssetIds((prev) =>
      prev.includes(assetId) ? prev.filter((id) => id !== assetId) : [...prev, assetId],
    );
  }

  // ── Scroll-driven visibility (Reanimated shared values) ───────────────────
  const scrollY = useSharedValue(0);
  const lastScrollY = useSharedValue(0);
  // Accumulated downward scroll since last direction reversal.
  // Resets to 0 the instant the user scrolls up → nav bar snaps back immediately.
  const navScrollOffset = useSharedValue(0);

  function onScrollUpdate(y) {
    const delta = y - lastScrollY.value;
    if (delta < -2) {
      navScrollOffset.value = withSpring(0, { damping: 20, stiffness: 250 });
    } else if (delta > 2) {
      navScrollOffset.value = Math.min(navScrollOffset.value + delta, 100);
    }
    lastScrollY.value = y;
    scrollY.value = y;
  }

  function resetScroll() {
    scrollY.value = 0;
    lastScrollY.value = 0;
    navScrollOffset.value = 0;
  }

  const value = {
    // Search
    isSearchActive,
    searchText,
    openSearch,
    closeSearch,
    setSearchText,

    // Filter modal
    isFilterModalOpen,
    filterModalData,
    openFilterModal,
    closeFilterModal,

    // Screen options registration
    registerScreenOptions,
    screenOptionsRef,

    // Select mode
    isSelectMode,
    selectedAssetIds,
    toggleSelectMode,
    exitSelectMode,
    toggleSelectAsset,

    // Scroll animation values (passed to animated components)
    scrollY,
    navScrollOffset,
    onScrollUpdate,
    resetScroll,
  };

  return <FloatingBarsContext value={value}>{children}</FloatingBarsContext>;
}
