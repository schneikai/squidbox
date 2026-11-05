import { createContext } from 'react';

// The overlay's actions (ProgressOverlayProvider): stable, so a progress tick re-renders none of
// their readers. `show({ onCancel })` adds a Cancel button.
export type ProgressOverlayActions = {
  show: (options?: { onCancel?: (() => void) | null }) => void;
  showBlocking: () => void;
  hide: () => void;
  updateProgress: (value: number) => void;
};

const ProgressOverlayContext = createContext<ProgressOverlayActions | null>(null);

export default ProgressOverlayContext;
