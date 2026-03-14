import { useState, useRef, useCallback } from 'react';
import { useSharedValue } from 'react-native-reanimated';

import FloatingBarsContext from './FloatingBarsContext';

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
  const screenOptionsRef = useRef({
    assets: null,
    albums: null,
    posts: null,
  });

  const registerScreenOptions = useCallback((tab, options) => {
    screenOptionsRef.current[tab] = options;
  }, []);

  function openFilterModal() {
    const activeTab = screenOptionsRef.current._activeTab ?? 'assets';
    setFilterModalData({ ...screenOptionsRef.current[activeTab] });
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

  // ── Scroll-driven nav visibility (Reanimated shared values) ───────────────
  const scrollY = useSharedValue(0);
  const lastScrollY = useSharedValue(0);
  const navBarVisible = useSharedValue(1);

  // Called by each main screen's FlatList via onScroll (JS thread)
  function onScrollUpdate(y) {
    if (y > lastScrollY.value + 10 && y > 50) {
      navBarVisible.value = 0;
    } else if (y < lastScrollY.value - 10) {
      navBarVisible.value = 1;
    }
    lastScrollY.value = y;
    scrollY.value = y;
  }

  // Reset nav state when switching tabs
  function resetScroll() {
    scrollY.value = 0;
    lastScrollY.value = 0;
    navBarVisible.value = 1;
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
    navBarVisible,
    onScrollUpdate,
    resetScroll,
  };

  return <FloatingBarsContext value={value}>{children}</FloatingBarsContext>;
}
