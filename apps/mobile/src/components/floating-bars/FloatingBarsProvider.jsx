import { useState, useCallback, useMemo } from 'react';
import { useSharedValue } from 'react-native-reanimated';

import FloatingBarsContext from './FloatingBarsContext';

export default function FloatingBarsProvider({ children }) {
  // ── Search ────────────────────────────────────────────────────────────────
  // Each main screen owns its search (see useSearchMode). The visible one reports whether its search
  // bar is open, so the navigation bar can make room for it.
  const [isSearchActive, setIsSearchActive] = useState(false);

  // ── Select mode: the Library screen owns its selection and reports only whether it's on, so a
  // selection change doesn't re-render every floating bar ─────────────────────────────────────
  const [isSelectMode, setIsSelectMode] = useState(false);

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

      // Select mode
      isSelectMode,
      setIsSelectMode,

      // Scroll animation values (passed to animated components)
      scrollY,
      isNavBarHidden,
      resetScroll,
    }),
    [isSearchActive, isSelectMode, scrollY, isNavBarHidden, resetScroll],
  );

  return <FloatingBarsContext value={value}>{children}</FloatingBarsContext>;
}
