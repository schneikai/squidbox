import { use } from 'react';

import SelectedAssetsContext from './SelectedAssetsContext';

export default function useSelectedAssets() {
  return use(SelectedAssetsContext);
}
