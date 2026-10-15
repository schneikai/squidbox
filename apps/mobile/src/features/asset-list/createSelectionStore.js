/**
 * Select mode and the selection of one asset grid, for its cells to subscribe to: a toggle or a
 * selection change re-renders only the selection overlays whose state changed, not every cell.
 */
export default function createSelectionStore() {
  let isSelectMode = false;
  let isAssetSelected = () => false;
  const listeners = new Set();

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    /** 'off' outside select mode, else 'selected' or 'unselected'. */
    stateOf(assetId) {
      if (!isSelectMode) return 'off';
      return isAssetSelected(assetId) ? 'selected' : 'unselected';
    },
    set(next) {
      isSelectMode = next.isSelectMode;
      isAssetSelected = next.isAssetSelected ?? (() => false);
      listeners.forEach((listener) => listener());
    },
  };
}
