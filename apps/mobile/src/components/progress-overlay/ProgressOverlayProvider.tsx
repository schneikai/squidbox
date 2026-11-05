import { type ReactNode, useState, useCallback, useMemo } from 'react';

import ProgressOverlayContext, { type ProgressOverlayActions } from './ProgressOverlayContext';
import ProgressOverlayHost from './ProgressOverlayHost';
import ProgressOverlayStateContext, { type ProgressOverlayState } from './ProgressOverlayStateContext';

export type ProgressOverlayProviderProps = { children?: ReactNode };
export default function ProgressOverlayProvider({ children }: ProgressOverlayProviderProps) {
  const [mode, setMode] = useState<ProgressOverlayState['mode']>(null);
  const [progress, setProgress] = useState(0);
  const [onCancel, setOnCancel] = useState<(() => void) | null>(null);

  // show({ onCancel }) adds a Cancel button; the caller stops at its next chance (see useRunWithProgress)
  // and hides as usual.
  const show = useCallback<ProgressOverlayActions['show']>(({ onCancel = null } = {}) => {
    setOnCancel(() => onCancel);
    setMode('progress');
  }, []);
  const showBlocking = useCallback(() => setMode('blocking'), []);
  const hide = useCallback(() => {
    setMode(null);
    setProgress(0);
    setOnCancel(null);
  }, []);
  const updateProgress = useCallback((value: number) => setProgress(value), []);

  // Actions are stable (memoized on stable callbacks) so action consumers never re-render on a
  // progress tick. The volatile { mode, progress, cancel } lives in a separate context read ONLY by
  // the overlay hosts — see ProgressOverlayStateContext — so ticks don't re-render the whole app.
  const actions = useMemo<ProgressOverlayActions>(
    () => ({ show, showBlocking, hide, updateProgress }),
    [show, showBlocking, hide, updateProgress],
  );
  const state = useMemo<ProgressOverlayState>(() => {
    // The button goes once pressed.
    const cancel = onCancel
      ? () => {
          onCancel();
          setOnCancel(null);
        }
      : null;
    return { mode, progress, cancel };
  }, [mode, progress, onCancel]);

  return (
    <ProgressOverlayContext.Provider value={actions}>
      <ProgressOverlayStateContext.Provider value={state}>
        {children}
        {/* Root host — covers the main app. Each sheet mounts its own host too (SheetRoute),
            because an in-tree overlay can't cover a native sheet from the root. */}
        <ProgressOverlayHost />
      </ProgressOverlayStateContext.Provider>
    </ProgressOverlayContext.Provider>
  );
}
