import { use } from 'react';

import AssetsContext from './AssetsContext';

export default function useCloud() {
  return use(AssetsContext);
}
