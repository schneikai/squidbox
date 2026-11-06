// A cell's state in the selection.
type SelectionState = 'off' | 'selected' | 'unselected';

type SelectionChange = { isSelectMode: boolean; isAssetSelected?: (assetId: string) => boolean };

export type SelectionStore = ReturnType<typeof createSelectionStore>;

/**
 * Select mode and the selection of one asset grid, for its cells to subscribe to: a toggle or a
 * selection change re-renders only the selection overlays whose state changed, not every cell.
 */
export default function createSelectionStore() {
  let isSelectMode = false;
  let isAssetSelected: (assetId: string) => boolean = () => false;
  const listeners = new Set<() => void>();

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    /** 'off' outside select mode, else 'selected' or 'unselected'. */
    stateOf(assetId: string): SelectionState {
      if (!isSelectMode) return 'off';
      return isAssetSelected(assetId) ? 'selected' : 'unselected';
    },
    set(next: SelectionChange) {
      isSelectMode = next.isSelectMode;
      isAssetSelected = next.isAssetSelected ?? (() => false);
      listeners.forEach((listener) => listener());
    },
  };
}
