import { use } from 'react';

import AssetsContext from './AssetsContext';

export default function useAssets() {
  return use(AssetsContext);
}
