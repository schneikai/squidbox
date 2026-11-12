import { type ReactNode, useState, useMemo } from 'react';

import FloatingBarsContext, { type FloatingBarsValue } from './FloatingBarsContext';

export type FloatingBarsProviderProps = { children?: ReactNode };
export default function FloatingBarsProvider({ children }: FloatingBarsProviderProps) {
  // ── Search ────────────────────────────────────────────────────────────────
  // Each main screen owns its search (see useListControls). The visible one reports whether its search
  // bar is open, so the navigation bar can make room for it.
  const [isSearchActive, setIsSearchActive] = useState(false);

  // ── Select mode: the Library screen owns its selection and reports only whether it's on, so a
  // selection change doesn't re-render every floating bar ─────────────────────────────────────
  const [isSelectMode, setIsSelectMode] = useState(false);

  // Memoized: the provider sits above the screens and re-renders with navigation and app-level
  // updates, which must not re-render every screen that uses the floating bars.
  const value = useMemo<FloatingBarsValue>(
    () => ({
      // Search
      isSearchActive,
      setIsSearchActive,

      // Select mode
      isSelectMode,
      setIsSelectMode,
    }),
    [isSearchActive, isSelectMode],
  );

  return <FloatingBarsContext value={value}>{children}</FloatingBarsContext>;
}
