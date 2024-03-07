import SelectedAssetsContext from './SelectedAssetsContext';

import useAssets from '@/features/assets-context/useAssets';

export default function SelectedAssetsProvider({ selectedAssetIds, children }) {
  const { assets } = useAssets();

  function getSelectedAssets() {
    return Object.values(assets).filter((asset) => selectedAssetIds.includes(asset.id));
  }

  return <SelectedAssetsContext.Provider value={getSelectedAssets}>{children}</SelectedAssetsContext.Provider>;
}
