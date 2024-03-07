import { useContext } from 'react';

import CloudContext from './CloudContext';

export default function useCloud() {
  return useContext(CloudContext);
}
