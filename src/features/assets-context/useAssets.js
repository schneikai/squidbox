import { useContext } from 'react';

import AssetsContext from './AssetsContext';

export default function useCloud() {
  return useContext(AssetsContext);
}
