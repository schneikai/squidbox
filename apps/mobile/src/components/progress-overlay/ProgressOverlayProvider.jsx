import { useState, useCallback, useMemo } from 'react';

import ProgressOverlayContext from './ProgressOverlayContext';
import ProgressOverlayHost from './ProgressOverlayHost';
import ProgressOverlayStateContext from './ProgressOverlayStateContext';

export default function ProgressOverlayProvider({ children }) {
  const [mode, setMode] = useState(null); // null | 'progress' | 'blocking'
  const [progress, setProgress] = useState(0);
  const [onCancel, setOnCancel] = useState(null);

  // show({ onCancel }) adds a Cancel button; the caller stops between its batches and hides as usual.
  const show = useCallback(({ onCancel = null } = {}) => {
    setOnCancel(() => onCancel);
    setMode('progress');
  }, []);
  const showBlocking = useCallback(() => setMode('blocking'), []);
  const hide = useCallback(() => {
    setMode(null);
    setProgress(0);
    setOnCancel(null);
  }, []);
  const updateProgress = useCallback((value) => setProgress(value), []);

  // Actions are stable (memoized on stable callbacks) so action consumers never re-render on a
  // progress tick. The volatile { mode, progress, cancel } lives in a separate context read ONLY by
  // the overlay hosts — see ProgressOverlayStateContext — so ticks don't re-render the whole app.
  const actions = useMemo(
    () => ({ show, showBlocking, hide, updateProgress }),
    [show, showBlocking, hide, updateProgress],
  );
  const state = useMemo(() => {
    // The button goes once pressed: the running batch still finishes, which the ring shows.
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
        {/* Root host — covers the main app. Each modal route mounts its own host too (see
            RootNavigator), because an in-tree overlay can't cover a native sheet from the root. */}
        <ProgressOverlayHost />
      </ProgressOverlayStateContext.Provider>
    </ProgressOverlayContext.Provider>
  );
}
