import { useContext } from 'react';

import SelectedAssetsContext from './SelectedAssetsContext';

export default function useSelectedAssets() {
  return useContext(SelectedAssetsContext);
}
