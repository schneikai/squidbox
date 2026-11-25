import { createContext } from 'react';

export type ProgressOverlayState = {
  mode: 'progress' | 'blocking' | null;
  progress: number;
  cancel: (() => void) | null;
  note: string | null;
};

// Volatile overlay state ({ mode, progress, cancel, note }) — kept SEPARATE from the stable actions context so
// that frequent updateProgress() ticks re-render only the overlay hosts, not every action consumer
// (the asset grid etc.). Only ProgressOverlayHost reads this.
const ProgressOverlayStateContext = createContext<ProgressOverlayState>({
  mode: null,
  progress: 0,
  cancel: null,
  note: null,
});

export default ProgressOverlayStateContext;
