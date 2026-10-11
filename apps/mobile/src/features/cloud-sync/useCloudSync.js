import { use } from 'react';

import CloudSyncContext from './CloudSyncContext';

export default function useCloudSync() {
  return use(CloudSyncContext);
}
