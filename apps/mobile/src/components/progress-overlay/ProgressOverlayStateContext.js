import { createContext } from 'react';

// Volatile overlay state ({ mode, progress }) — kept SEPARATE from the stable actions context so
// that frequent updateProgress() ticks re-render only the overlay hosts, not every action consumer
// (the asset grid etc.). Only ProgressOverlayHost reads this.
const ProgressOverlayStateContext = createContext({ mode: null, progress: 0 });

export default ProgressOverlayStateContext;
