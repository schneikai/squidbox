import { useContext } from 'react';

import CloudSyncContext from './CloudSyncContext';

export default function useCloud() {
  return useContext(CloudSyncContext);
}
