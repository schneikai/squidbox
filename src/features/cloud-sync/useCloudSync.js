import { use } from 'react';

import CloudSyncContext from './CloudSyncContext';

export default function useCloud() {
  return use(CloudSyncContext);
}
